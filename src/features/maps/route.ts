import { z } from "zod";

const pakistanBounds = { south: 23, north: 37.5, west: 60, east: 78.5 };
const coordinate = z.object({
  id: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/),
  name: z.string().trim().min(1).max(120),
  latitude: z.number().finite().min(pakistanBounds.south).max(pakistanBounds.north),
  longitude: z.number().finite().min(pakistanBounds.west).max(pakistanBounds.east),
});

export const routeRequestSchema = z.object({ stops: z.array(coordinate).min(1).max(8) });
export type RouteStopInput = z.infer<typeof coordinate>;
export const routeProvider = "OSRM community demo";
const routerOrigin = "https://router.project-osrm.org";

const coordinatePair = z.tuple([z.number().finite().min(-180).max(180), z.number().finite().min(-90).max(90)]);
const osrmResponse = z.object({
  code: z.string(),
  routes: z.array(z.object({
    distance: z.number().finite().nonnegative(), duration: z.number().finite().nonnegative(),
    geometry: z.object({ type: z.literal("LineString"), coordinates: z.array(coordinatePair).min(2).max(30000) }),
  })).max(5).optional(),
});

export type RouteEstimate =
  | { status: "single-stop"; provider: string; retrievedAt: string }
  | { status: "no-route"; provider: string; retrievedAt: string }
  | { status: "ok"; provider: string; retrievedAt: string; distanceMeters: number; durationSeconds: number; geometry: { type: "LineString"; coordinates: [number, number][] } };

export class RouteUnavailable extends Error {}

export function buildOsrmUrl(stops: RouteStopInput[]) {
  const points = stops.map((stop) => `${stop.longitude.toFixed(6)},${stop.latitude.toFixed(6)}`).join(";");
  return `${routerOrigin}/route/v1/driving/${points}?overview=simplified&geometries=geojson&steps=false&alternatives=false`;
}

export async function estimateDrivingRoute(
  input: unknown,
  fetcher: typeof fetch = fetch,
  now = new Date(),
): Promise<RouteEstimate> {
  const { stops } = routeRequestSchema.parse(input);
  const retrievedAt = now.toISOString();
  if (stops.length === 1) return { status: "single-stop", provider: routeProvider, retrievedAt };

  try {
    const response = await fetcher(buildOsrmUrl(stops), {
      method: "GET", cache: "no-store", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) throw new RouteUnavailable("Route service is unavailable.");
    const body = await response.text();
    if (body.length > 512_000) throw new RouteUnavailable("Route response is too large.");
    const parsedJson: unknown = JSON.parse(body);
    const parsed = osrmResponse.safeParse(parsedJson);
    if (!parsed.success) throw new RouteUnavailable("Route service returned an invalid result.");
    if (parsed.data.code === "NoRoute" || !parsed.data.routes?.length) return { status: "no-route", provider: routeProvider, retrievedAt };
    if (parsed.data.code !== "Ok") throw new RouteUnavailable("Route service could not estimate this route.");
    const route = parsed.data.routes[0];
    return {
      status: "ok", provider: routeProvider, retrievedAt,
      distanceMeters: route.distance, durationSeconds: route.duration, geometry: route.geometry,
    };
  } catch (error) {
    if (error instanceof RouteUnavailable) throw error;
    throw new RouteUnavailable("Route service is unavailable. Your place order is unchanged.");
  }
}

type QuotaState = { lastGlobalRequest: number; clients: Map<string, number[]> };
const globalState = globalThis as typeof globalThis & { __gochitralRouteQuota?: QuotaState };
const quotaState = globalState.__gochitralRouteQuota ??= { lastGlobalRequest: 0, clients: new Map<string, number[]>() };

export function takeRoutePermit(clientKey: string, now = Date.now()) {
  // The OSRM demo asks external clients not to exceed one call per second.
  const globalWait = Math.max(0, 1100 - (now - quotaState.lastGlobalRequest));
  const recent = (quotaState.clients.get(clientKey) ?? []).filter((time) => now - time < 60_000);
  const clientWait = recent.length >= 5 ? Math.max(1000, 60_000 - (now - recent[0])) : 0;
  if (globalWait || clientWait) {
    quotaState.clients.set(clientKey, recent);
    return { allowed: false, retryAfterMs: Math.max(globalWait, clientWait) };
  }
  quotaState.lastGlobalRequest = now;
  quotaState.clients.set(clientKey, [...recent, now]);
  if (quotaState.clients.size > 1000) {
    for (const [key, times] of quotaState.clients) if (!times.some((time) => now - time < 60_000)) quotaState.clients.delete(key);
  }
  return { allowed: true, retryAfterMs: 0 };
}

export function resetRouteQuotaForVerification() {
  quotaState.lastGlobalRequest = 0;
  quotaState.clients.clear();
}
