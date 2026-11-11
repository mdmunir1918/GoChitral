import { session, userDatabase } from "@/lib/auth/session";
import { GuideRequestLimit, GuideRequestMismatch, GuideRequestUnavailable, guideRequestInput, submitGuideRequest } from "@/features/guides/requests";

const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: Request, context: RouteContext<"/api/guides/[id]/requests">) {
  if (request.headers.get("origin") !== process.env.APP_ORIGIN) return Response.json({ error: "Refresh the app at its usual address and try again." }, { status: 403, headers });
  const identity = await session();
  if (!identity) return Response.json({ error: "Sign in with a tourist account to request a guide." }, { status: 401, headers });
  if (identity.account.role !== "tourist") return Response.json({ error: "Guide requests are available to tourist accounts." }, { status: 403, headers });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return Response.json({ error: "Send a valid guide request." }, { status: 415, headers });
  try {
    const reader = request.body?.getReader(); if (!reader) throw new Error();
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length;
      if (size > 8000) { await reader.cancel(); return Response.json({ error: "This request is too large." }, { status: 413, headers }); }
      chunks.push(part.value);
    }
    const parsed = guideRequestInput.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 422, headers });
    const { id } = await context.params;
    const result = await userDatabase(identity, tx => submitGuideRequest(tx, identity.user.id, id, parsed.data), { timeout: 30000 });
    return Response.json(result, { headers });
  } catch (error) {
    if (error instanceof GuideRequestLimit) return Response.json({ error: error.message }, { status: 429, headers });
    if (error instanceof GuideRequestMismatch) return Response.json({ error: error.message }, { status: 409, headers });
    if (error instanceof GuideRequestUnavailable) return Response.json({ error: error.message }, { status: 404, headers });
    if (error instanceof Error && error.message.startsWith("Choose service dates")) return Response.json({ error: error.message }, { status: 422, headers });
    return Response.json({ error: "We could not submit your guide request. Retry with the same request key to check safely." }, { status: 503, headers });
  }
}
