import { readPlannerCatalogue } from "@/features/planner/database";
import { quotePlan, reviewSchema } from "@/features/planner/model";

const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: Request) {
  if (request.headers.get("origin") !== process.env.APP_ORIGIN) return Response.json({ error: "Refresh the app at its usual address and try again." }, { status: 403, headers });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return Response.json({ error: "Send a valid trip draft." }, { status: 415, headers });
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: "Your draft is empty." }, { status: 400, headers });
  try {
    const chunks: Uint8Array[] = []; let length = 0;
    while (true) {
      const part = await reader.read(); if (part.done) break;
      length += part.value.length;
      if (length > 64000) { await reader.cancel(); return Response.json({ error: "This draft is too large. Use at most 120 items." }, { status: 413, headers }); }
      chunks.push(part.value);
    }
    const parsed = reviewSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 422, headers });
    try { return Response.json(quotePlan(parsed.data, await readPlannerCatalogue()), { headers }); }
    catch { return Response.json({ error: "Current prices could not be loaded. Your selections are still here. Please try again." }, { status: 503, headers }); }
  } catch { return Response.json({ error: "Your draft could not be read. Check the details and try again." }, { status: 400, headers }); }
}
