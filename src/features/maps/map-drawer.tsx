"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { dateLabel } from "@/features/planner/model";
import type { RouteEstimate } from "./route";

export type MapStop = {
  id: string;
  title: string;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  visitorNote?: string;
  reviewed?: string;
};

const TileMap = dynamic(() => import("./tile-map").then((module) => module.TileMap), {
  ssr: false,
  loading: () => <div className="route-loading" role="status">Loading map…</div>,
});

function distanceLabel(meters: number) {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(1)} km`;
}

export function MapDrawer({ stops, label = "Open map" }: { stops: MapStop[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [route, setRoute] = useState<RouteEstimate | null>(null);
  const [message, setMessage] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const mapped = useMemo(() => stops.filter((stop) => Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude)), [stops]);
  const allMapped = mapped.length === stops.length;
  const canEstimate = stops.length >= 2 && stops.length <= 8 && allMapped;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      closeRef.current?.focus();
    } else if (!open && dialog.open) dialog.close();
  }, [open]);

  async function estimate() {
    if (!canEstimate) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/routes/estimate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stops: stops.map(({ id, title, latitude, longitude }) => ({ id, name: title, latitude, longitude })) }),
        signal: AbortSignal.timeout(10_000),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "The route service is not available. Your place order is unchanged; you can retry.");
      setRoute(result as RouteEstimate);
    } catch (error) {
      setMessage(error instanceof Error && error.name !== "TimeoutError" ? error.message : "The route request timed out. Your place order is unchanged; you can retry.");
      setRoute(null);
    } finally { setBusy(false); }
  }

  return <div className="map-drawer-control">
    <button className="secondary" type="button" onClick={() => { setOpen(true); setMessage(""); setRoute(null); }}>{label}</button>
    <dialog className="map-dialog" ref={dialogRef} aria-labelledby="map-dialog-title" onCancel={(event) => { event.preventDefault(); setOpen(false); }} onClose={() => setOpen(false)}>
      {open && <section className="map-dialog-content">
        <header className="map-dialog-heading"><div><p className="listing-location">Maps and directions</p><h2 id="map-dialog-title">Places on your route</h2></div>
          <button ref={closeRef} type="button" className="secondary" onClick={() => setOpen(false)}>Close map</button></header>
        {mapped.length > 0
          ? <TileMap stops={mapped.map((stop) => ({ id: stop.id, title: stop.title, latitude: stop.latitude!, longitude: stop.longitude! }))} geometry={route?.status === "ok" ? route.geometry : undefined} />
          : <p className="map-status" role="status">A map point has not been added for these places yet. You can still use the place names and notes below.</p>}
        {stops.length === 1 && <p className="map-status">One place selected. Add another mapped stop in your plan to estimate a driving route.</p>}
        {stops.length > 1 && !allMapped && <p className="map-status">Some stops do not have verified map points. Their names and order are kept below; route estimates are unavailable for this selection.</p>}
        {stops.length > 8 && <p className="map-status" role="status">This map supports up to eight stops at a time. All your place names and notes are still shown below.</p>}
        {route?.status === "ok" && <div className="route-estimate" role="status"><h3>Estimated driving route</h3>
          <p>{distanceLabel(route.distanceMeters)} · about {Math.max(1, Math.round(route.durationSeconds / 60))} min</p>
          <p>{route.provider} · checked {new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", dateStyle: "medium", timeStyle: "short" }).format(new Date(route.retrievedAt))} (Asia/Karachi)</p>
          <p>Road conditions are unknown. Check local advice before travelling.</p>
        </div>}
        {route?.status === "no-route" && <p className="map-status" role="status">No driving route was found. Your place names and order are unchanged; you can retry.</p>}
        {message && <p className="map-status" role="alert">{message}</p>}
        {canEstimate && <button type="button" disabled={busy} onClick={() => void estimate()}>{busy ? "Estimating…" : route?.status === "ok" ? "Retry route estimate" : "Estimate driving route"}</button>}
        <p className="map-provider-note">Map tiles and route estimates can be unavailable. This map does not confirm road closures or safety. No map tiles are saved for offline use.</p>
        <ol className="map-stop-list">{stops.map((stop, index) => <li key={`${stop.id}-${index}`}>
          <h3>{index + 1}. {stop.title}</h3><p>{stop.location}</p>
          {stop.latitude == null || stop.longitude == null ? <p>Map point unavailable.</p> : <p>Map point · {stop.latitude.toFixed(4)}, {stop.longitude.toFixed(4)}</p>}
          {stop.visitorNote && <p><strong>Local visitor note</strong> · {stop.visitorNote}</p>}
          {stop.reviewed && <p>Note last reviewed {dateLabel(stop.reviewed)}. This is not a live road update.</p>}
        </li>)}</ol>
      </section>}
    </dialog>
  </div>;
}
