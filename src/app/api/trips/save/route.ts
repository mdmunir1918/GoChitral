import { session, userDatabase } from "@/lib/auth/session";
import { saveTrip, TripConflict, TripGuideRequestsDateConflict, TripReplayMismatch, TripUnavailable, TripValidation } from "@/features/trips/save";
import { saveTripSchema } from "@/features/trips/validation";
import { revalidatePath } from "next/cache";

const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: Request) {
  if (request.headers.get("origin") !== process.env.APP_ORIGIN) return Response.json({ error: "Refresh the app at its usual address and try again." }, { status: 403, headers });
  const identity = await session();
  if (!identity) return Response.json({ error: "Sign in to save your itinerary. Your draft stays on this device." }, { status: 401, headers });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return Response.json({ error: "Send a valid itinerary." }, { status: 415, headers });
  let parsed;
  try {
    const reader = request.body?.getReader(); if (!reader) throw new Error();
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length;
      if (size > 64000) { await reader.cancel(); return Response.json({ error: "This itinerary is too large." }, { status: 413, headers }); }
      chunks.push(part.value);
    }
    parsed = saveTripSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } catch { return Response.json({ error: "The itinerary could not be read. Your draft is preserved." }, { status: 400, headers }); }
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 422, headers });
  try {
    const result = await userDatabase(identity, tx => saveTrip(tx, identity.user.id, parsed.data), { timeout: 60000 });
    revalidatePath("/my-trips");
    revalidatePath(`/my-trips/${result.id}`);
    revalidatePath(`/my-trips/${result.id}/edit`);
    revalidatePath(`/my-trips/${result.id}/print`);
    return Response.json(result, { headers });
  } catch (error) {
    if (error instanceof TripConflict || error instanceof TripReplayMismatch) return Response.json({ error: error.message, conflict: true, tripId: error.tripId }, { status: 409, headers });
    if (error instanceof TripGuideRequestsDateConflict) return Response.json({ error: error.message, requests: error.requests.map(request => ({ ...request, startDate: request.startDate.toISOString().slice(0, 10), endDate: request.endDate.toISOString().slice(0, 10) })) }, { status: 409, headers });
    if (error instanceof TripUnavailable) return Response.json({ error: error.message }, { status: 404, headers });
    if (error instanceof TripValidation) return Response.json({ error: error.message, quote: error.quote }, { status: 422, headers });
    return Response.json({ error: "We could not confirm the save. Your draft is preserved. Retry Save itinerary to check safely." }, { status: 503, headers });
  }
}
