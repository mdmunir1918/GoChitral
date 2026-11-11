import { createHmac } from "node:crypto";
import { estimateDrivingRoute, routeRequestSchema, RouteUnavailable, takeRoutePermit } from "@/features/maps/route";

const headers = { "Cache-Control": "private, no-store" };
const maxBodyBytes = 8_192;

async function readBody(request: Request) {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBodyBytes) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== process.env.APP_ORIGIN) return Response.json({ error: "Refresh the app at its usual address and try again." }, { status: 403, headers });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return Response.json({ error: "Send the mapped stops as JSON." }, { status: 415, headers });
  const declaredSize = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > maxBodyBytes) return Response.json({ error: "Choose at most eight stops." }, { status: 413, headers });
  let text: string | null;
  try { text = await readBody(request); } catch { text = null; }
  if (text === null) return Response.json({ error: "The map request is too large or could not be read." }, { status: 413, headers });
  let body: unknown;
  try { body = JSON.parse(text); } catch { return Response.json({ error: "Check the selected stops and try again." }, { status: 400, headers }); }
  const parsed = routeRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Choose valid mapped stops in Pakistan." }, { status: 422, headers });
  if (parsed.data.stops.length === 1) return Response.json(await estimateDrivingRoute(parsed.data), { headers });
  if (!process.env.AUTH_SECRET) return Response.json({ error: "Route estimates are temporarily unavailable." }, { status: 503, headers });

  const clientAddress = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "shared";
  const clientKey = createHmac("sha256", process.env.AUTH_SECRET).update(clientAddress).digest("hex");
  const permit = takeRoutePermit(clientKey);
  if (!permit.allowed) return Response.json({ error: "Please wait a moment before requesting another route." }, {
    status: 429, headers: { ...headers, "Retry-After": String(Math.max(1, Math.ceil(permit.retryAfterMs / 1000))) },
  });

  try {
    return Response.json(await estimateDrivingRoute(parsed.data), { headers });
  } catch (error) {
    if (error instanceof RouteUnavailable) {
      const noRoute = error.message.includes("could not estimate") || error.message.includes("No drivable route");
      return Response.json({ error: noRoute ? "No driving route was found. Your place names and order are unchanged." : "The route service did not answer. Your place names and order are unchanged; you can retry." }, { status: noRoute ? 422 : 503, headers });
    }
    return Response.json({ error: "The route service did not answer. Your place names and order are unchanged; you can retry." }, { status: 503, headers });
  }
}
