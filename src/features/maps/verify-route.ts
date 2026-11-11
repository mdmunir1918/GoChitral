import assert from "node:assert/strict";
import { buildOsrmUrl, estimateDrivingRoute, resetRouteQuotaForVerification, RouteUnavailable, routeRequestSchema, takeRoutePermit } from "./route";

const stops = [
  { id: "dest-001", name: "Bumburet Valley", latitude: 35.698814, longitude: 71.6858 },
  { id: "act-001", name: "Kalasha Dur Museum", latitude: 35.69746, longitude: 71.68216 },
];

async function verify() {
  assert.equal(routeRequestSchema.safeParse({ stops }).success, true);
  assert.equal(routeRequestSchema.safeParse({ stops: [{ ...stops[0], latitude: 95 }] }).success, false, "Out-of-range latitude must be rejected.");
  assert.equal(routeRequestSchema.safeParse({ stops: [{ ...stops[0], longitude: 200 }] }).success, false, "Out-of-range longitude must be rejected.");
  assert.equal(routeRequestSchema.safeParse({ stops: Array(9).fill(stops[0]) }).success, false, "At most eight stops are allowed.");
  assert.equal(new URL(buildOsrmUrl(stops)).hostname, "router.project-osrm.org", "The route host must be fixed.");
  assert(buildOsrmUrl(stops).includes("/route/v1/driving/71.685800,35.698814;71.682160,35.697460"), "Coordinates must use OSRM's longitude,latitude order.");

  let called = false;
  const single = await estimateDrivingRoute({ stops: [stops[0]] }, async () => { called = true; throw new Error("Must not call provider for one stop."); });
  assert.equal(single.status, "single-stop"); assert.equal(called, false);

  const success = await estimateDrivingRoute({ stops }, async (input, init) => {
    assert.equal(new URL(String(input)).hostname, "router.project-osrm.org");
    assert.equal(init?.cache, "no-store");
    assert(init?.signal);
    return new Response(JSON.stringify({ code: "Ok", routes: [{ distance: 1200, duration: 600, geometry: { type: "LineString", coordinates: [[71.6858,35.698814],[71.68216,35.69746]] } }] }), { status: 200 });
  });
  assert.equal(success.status, "ok");
  if (success.status === "ok") { assert.equal(success.distanceMeters, 1200); assert.equal(success.durationSeconds, 600); assert.equal(success.geometry.coordinates.length, 2); }

  const unreachable = await estimateDrivingRoute({ stops }, async () => new Response(JSON.stringify({ code: "NoRoute", routes: [] }), { status: 200 }));
  assert.equal(unreachable.status, "no-route");
  await assert.rejects(estimateDrivingRoute({ stops }, async () => { throw new DOMException("Timed out", "TimeoutError"); }), RouteUnavailable);
  await assert.rejects(estimateDrivingRoute({ stops }, async () => new Response("not-json", { status: 200 })), RouteUnavailable);
  await assert.rejects(estimateDrivingRoute({ stops }, async () => new Response("", { status: 503 })), RouteUnavailable);

  resetRouteQuotaForVerification();
  assert.equal(takeRoutePermit("client-a", 1_000_000).allowed, true);
  assert.equal(takeRoutePermit("client-b", 1_000_100).allowed, false, "Global calls must wait at least 1.1 seconds.");
  for (let index = 1; index < 5; index++) assert.equal(takeRoutePermit("client-a", 1_000_000 + index * 1_101).allowed, true);
  const capped = takeRoutePermit("client-a", 1_006_000);
  assert.equal(capped.allowed, false, "A client is capped at five estimates per minute.");
  assert(capped.retryAfterMs > 0);
  resetRouteQuotaForVerification();

  console.log("Maps: coordinate and stop bounds, fixed OSRM host/mode, single-stop no-call, successful estimate, unreachable routes, timeout, invalid responses and global/client quotas passed.");
}

void verify();
