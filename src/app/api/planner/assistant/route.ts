import { createHmac } from "node:crypto";
import { readPublishedListings } from "@/features/catalogue/database";
import { generateAssistantPlan, assistantRequestSchema } from "@/features/planner/assistant";
import { readPlannerCatalogue } from "@/features/planner/database";

const bodyLimit = 4096;
const requestTimes = new Map<string, number[]>();

function permit(key: string, now = Date.now()) {
  const recent = (requestTimes.get(key) ?? []).filter((time) => now - time < 60_000);
  if (recent.length >= 10) { requestTimes.set(key, recent); return false; }
  requestTimes.set(key, [...recent, now]);
  if (requestTimes.size > 1000) for (const [client, times] of requestTimes) if (!times.some((time) => now - time < 60_000)) requestTimes.delete(client);
  return true;
}

export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (!process.env.APP_ORIGIN || request.headers.get("origin") !== process.env.APP_ORIGIN) return Response.json({ error: "Refresh the site at its usual address and try again." }, { status: 403, headers });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return Response.json({ error: "Send trip details as JSON." }, { status: 415, headers });
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > bodyLimit) return Response.json({ error: "Check the trip details and try again." }, { status: 413, headers });
  let body = "";
  if (request.body) {
    const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const part = await reader.read(); if (part.done) break;
        size += part.value.byteLength;
        if (size > bodyLimit) { await reader.cancel(); return Response.json({ error: "Check the trip details and try again." }, { status: 413, headers }); }
        chunks.push(part.value);
      }
    } catch { return Response.json({ error: "We could not read these trip details. Try again." }, { status: 400, headers }); }
    finally { reader.releaseLock(); }
    body = Buffer.concat(chunks).toString("utf8");
  }
  let value: unknown;
  try { value = JSON.parse(body); } catch { return Response.json({ error: "Check the trip details and try again." }, { status: 400, headers }); }
  const parsed = assistantRequestSchema.safeParse(value);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Check your dates, budget and destinations." }, { status: 422, headers });
  if (!process.env.AUTH_SECRET) return Response.json({ error: "The trip assistant is not configured." }, { status: 503, headers });
  const address = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "shared";
  const key = createHmac("sha256", process.env.AUTH_SECRET).update(address).digest("hex");
  if (!permit(key)) return Response.json({ error: "Please wait a minute before generating another plan." }, { status: 429, headers });
  try {
    const [listings, plannerCatalogue] = await Promise.all([readPublishedListings(), readPlannerCatalogue()]);
    const plan = generateAssistantPlan(parsed.data, listings, plannerCatalogue);
    return Response.json({ plan }, { headers });
  } catch (error) {
    if (error instanceof Error && error.message === "Choose destinations that are currently published.") return Response.json({ error: error.message }, { status: 422, headers });
    return Response.json({ error: "The trip plan could not be generated right now. Your details are still in this page; try again." }, { status: 503, headers });
  }
}
