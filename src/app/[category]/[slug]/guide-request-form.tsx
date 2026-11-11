"use client";

import Link from "next/link";
import { useState } from "react";

type TripOption = { id: string; title: string; start: string; end: string };
export function GuideRequestForm({ guideId, trips }: { guideId: string; trips: TripOption[] }) {
  const [tripId, setTripId] = useState(trips[0]?.id ?? "");
  const selected = trips.find(trip => trip.id === tripId);
  const [start, setStart] = useState(selected?.start ?? ""), [end, setEnd] = useState(selected?.end ?? "");
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [reference, setReference] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/guides/${encodeURIComponent(guideId)}/requests`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, tripId, start, end }), signal: AbortSignal.timeout(30000) });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.reference) throw new Error(result?.error || "We could not submit the request. Please try again.");
      setReference(result.reference); setMessage("Your request is pending administrator review."); setKey(crypto.randomUUID());
    } catch (error) { setMessage(error instanceof Error ? error.message : "We could not submit the request. Please try again."); }
    finally { setBusy(false); }
  }
  if (!trips.length) return <p>Save an itinerary first, then return here to request a guide. <Link className="text-link" href="/plan">Plan a trip</Link>.</p>;
  return <form className="guide-request-form" onSubmit={event => void submit(event)}>
    <label htmlFor="guide-trip">Saved trip<select id="guide-trip" required value={tripId} onChange={event => {
      const next = trips.find(trip => trip.id === event.target.value); setTripId(event.target.value);
      if (next) { setStart(next.start); setEnd(next.end); }
      setReference("");
    }}>{trips.map(trip => <option value={trip.id} key={trip.id}>{trip.title} · {trip.start} to {trip.end}</option>)}</select></label>
    <div className="coordinate-fields">
      <label htmlFor="guide-start">Service starts<input id="guide-start" type="date" required min={selected?.start} max={selected?.end} value={start} onChange={event => setStart(event.target.value)} /></label>
      <label htmlFor="guide-end">Service ends<input id="guide-end" type="date" required min={start || selected?.start} max={selected?.end} value={end} onChange={event => setEnd(event.target.value)} /></label>
    </div>
    <p>Dates are inclusive. The request stays pending until an administrator reviews it. Submitting a request is not a confirmed booking.</p>
    {message && <p role="status">{message}{reference && <> Reference: <Link className="text-link" href={`/my-trips/requests/${reference}`}>{reference}</Link></>}</p>}
    <button type="submit" disabled={busy || !selected}>{busy ? "Sending…" : "Request this guide"}</button>
  </form>;
}
