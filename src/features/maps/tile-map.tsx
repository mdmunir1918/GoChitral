"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RouteEstimate } from "./route";

type Point = { id: string; title: string; latitude: number; longitude: number };
type View = { zoom: number; x: number; y: number };
const tileSize = 256, minZoom = 3, maxZoom = 17;

function worldPoint(latitude: number, longitude: number, zoom: number) {
  const scale = tileSize * 2 ** zoom;
  const lat = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const sin = Math.sin(lat * Math.PI / 180);
  return { x: (longitude + 180) / 360 * scale, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale };
}

function fitView(points: Point[], width: number, height: number): View {
  const projected = points.map((point) => worldPoint(point.latitude, point.longitude, maxZoom));
  const minX = Math.min(...projected.map((point) => point.x)), maxX = Math.max(...projected.map((point) => point.x));
  const minY = Math.min(...projected.map((point) => point.y)), maxY = Math.max(...projected.map((point) => point.y));
  let zoom = maxZoom;
  if (points.length === 1) zoom = 12;
  else {
    for (; zoom > minZoom; zoom--) {
      const scale = 2 ** (zoom - maxZoom);
      if ((maxX - minX) * scale <= width - 96 && (maxY - minY) * scale <= height - 96) break;
    }
  }
  const centerAtMax = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  const scale = 2 ** (zoom - maxZoom);
  return { zoom, x: centerAtMax.x * scale, y: centerAtMax.y * scale };
}

function routePath(points: [number, number][], view: View, width: number, height: number) {
  const left = view.x - width / 2, top = view.y - height / 2;
  return points.map(([longitude, latitude], index) => {
    const point = worldPoint(latitude, longitude, view.zoom);
    return `${index ? "L" : "M"}${point.x - left},${point.y - top}`;
  }).join(" ");
}

export function TileMap({ stops, geometry }: { stops: Point[]; geometry?: Extract<RouteEstimate, { status: "ok" }>["geometry"] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; centerX: number; centerY: number } | null>(null);
  const [size, setSize] = useState({ width: 720, height: 380 });
  const [viewOverride, setViewOverride] = useState<{ signature: string; view: View } | null>(null);
  const [tileFailureFor, setTileFailureFor] = useState<string | null>(null);
  const [selected, setSelected] = useState("");
  const stopSignature = stops.map((stop) => `${stop.id}:${stop.latitude}:${stop.longitude}`).join("|");
  const fitPoints = useMemo(() => stops.map(({ id, title, latitude, longitude }) => ({ id, title, latitude, longitude })), [stops]);
  const view = viewOverride?.signature === stopSignature
    ? viewOverride.view
    : fitView(fitPoints, Math.max(320, size.width), Math.max(240, size.height));

  useEffect(() => {
    const element = mapRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: Math.round(entry.contentRect.width), height: Math.round(entry.contentRect.height) }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const tiles = useMemo(() => {
    if (!view) return [];
    const left = view.x - size.width / 2, top = view.y - size.height / 2;
    const firstX = Math.floor(left / tileSize), lastX = Math.floor((left + size.width) / tileSize);
    const firstY = Math.floor(top / tileSize), lastY = Math.floor((top + size.height) / tileSize);
    const across = 2 ** view.zoom;
    const result: { key: string; x: number; y: number; left: number; top: number }[] = [];
    for (let tileY = firstY; tileY <= lastY; tileY++) for (let tileX = firstX; tileX <= lastX; tileX++) {
      if (tileY < 0 || tileY >= across) continue;
      const wrappedX = ((tileX % across) + across) % across;
      result.push({ key: `${view.zoom}/${wrappedX}/${tileY}`, x: wrappedX, y: tileY, left: tileX * tileSize - left, top: tileY * tileSize - top });
    }
    return result;
  }, [view, size.width, size.height]);

  const visibleStops = view ? stops.map((stop, index) => {
    const point = worldPoint(stop.latitude, stop.longitude, view.zoom);
    return { ...stop, index, left: point.x - (view.x - size.width / 2), top: point.y - (view.y - size.height / 2) };
  }) : [];

  function zoomBy(amount: number) {
    const zoom = Math.max(minZoom, Math.min(maxZoom, view.zoom + amount));
    const scale = 2 ** (zoom - view.zoom);
    setViewOverride({ signature: stopSignature, view: { zoom, x: view.x * scale, y: view.y * scale } });
  }

  return <div className="tile-map-wrap">
    <div ref={mapRef} className="tile-map" role="region" aria-label="Interactive map. Place names and access notes are listed below.">
      {/* Use direct OSM tiles so requests, attribution and cache behavior follow the tile usage policy. */}
      {view && tiles.map((tile) => <img key={tile.key} className="map-tile" alt="" draggable={false}
        src={`https://tile.openstreetmap.org/${view.zoom}/${tile.x}/${tile.y}.png`}
        referrerPolicy="strict-origin-when-cross-origin" style={{ left: tile.left, top: tile.top }} onError={() => setTileFailureFor(stopSignature)} />)}
      {view && geometry && <svg className="map-route-line" width={size.width} height={size.height} viewBox={`0 0 ${size.width} ${size.height}`} aria-hidden="true">
        <path d={routePath(geometry.coordinates, view, size.width, size.height)} />
      </svg>}
      {visibleStops.map((stop) => <button type="button" key={stop.id} className="map-marker" aria-label={`Stop ${stop.index + 1}: ${stop.title}`} title={stop.title}
        style={{ left: stop.left, top: stop.top }} onClick={() => setSelected(selected === stop.id ? "" : stop.id)} onFocus={() => setSelected(stop.id)}>
        <span>{stop.index + 1}</span>{selected === stop.id && <span className="map-marker-label">{stop.title}</span>}
      </button>)}
      <div className="map-zoom-controls" aria-label="Map zoom controls"><button type="button" aria-label="Zoom in" onClick={() => zoomBy(1)}>+</button><button type="button" aria-label="Zoom out" onClick={() => zoomBy(-1)}>−</button></div>
      <div className="map-attribution"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></div>
      <div className="map-pan-surface" aria-hidden="true" onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest("button, a")) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = { x: event.clientX, y: event.clientY, centerX: view?.x ?? 0, centerY: view?.y ?? 0 };
      }} onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag) return;
        setViewOverride({ signature: stopSignature, view: { ...view, x: drag.centerX - (event.clientX - drag.x), y: drag.centerY - (event.clientY - drag.y) } });
      }} onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }} />
      {tileFailureFor === stopSignature && <p className="map-tile-warning" role="status">Some map tiles could not load. The place list and route estimate remain available.</p>}
    </div>
  </div>;
}
