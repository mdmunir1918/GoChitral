import { createHmac } from "node:crypto";
import { z } from "zod";
import { readActiveKnowledge } from "@/features/recommendations/database";
import { answerReviewedQuestion } from "@/features/recommendations/knowledge";
import { getPrisma } from "@/lib/prisma";

const requestSchema = z.object({ question: z.string().trim().min(3).max(300), contextListingId: z.string().max(100).optional() }).strict();
const bodyLimit = 4096;
const requestTimes = new Map<string, number[]>();

function permit(key: string, now = Date.now()) {
  const current = (requestTimes.get(key) ?? []).filter((time) => now - time < 60_000);
  if (current.length >= 10) { requestTimes.set(key, current); return false; }
  requestTimes.set(key, [...current, now]);
  if (requestTimes.size > 1000) for (const [client, times] of requestTimes) if (!times.some((time) => now - time < 60_000)) requestTimes.delete(client);
  return true;
}

export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (!process.env.APP_ORIGIN || request.headers.get("origin") !== process.env.APP_ORIGIN) return Response.json({ error: "Refresh the site at its usual address and try again." }, { status: 403, headers });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return Response.json({ error: "Send your question as JSON." }, { status: 415, headers });
  const size = Number(request.headers.get("content-length"));
  if (Number.isFinite(size) && size > bodyLimit) return Response.json({ error: "Keep your question under 300 characters." }, { status: 413, headers });
  let raw = "";
  if (request.body) {
    const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
    try { while (true) { const part = await reader.read(); if (part.done) break; length += part.value.byteLength; if (length > bodyLimit) { await reader.cancel(); return Response.json({ error: "Keep your question under 300 characters." }, { status: 413, headers }); } chunks.push(part.value); } }
    catch { return Response.json({ error: "We could not read that question. Try again." }, { status: 400, headers }); }
    finally { reader.releaseLock(); }
    raw = Buffer.concat(chunks).toString("utf8");
  }
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return Response.json({ error: "Check the question and try again." }, { status: 400, headers }); }
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Write a short question." }, { status: 422, headers });
  if (!process.env.AUTH_SECRET) return Response.json({ error: "The local assistant is not configured." }, { status: 503, headers });
  const address = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "shared";
  const clientKey = createHmac("sha256", process.env.AUTH_SECRET).update(address).digest("hex");
  if (!permit(clientKey)) return Response.json({ error: "Please wait a minute before asking another question." }, { status: 429, headers });
  try {
    const entries = await readActiveKnowledge();
    const result = answerReviewedQuestion(parsed.data.question, entries, parsed.data.contextListingId);
    if (result.status === "fallback") return Response.json({ ...result, message: "I could not find a current, reviewed answer for that. Try one of these topics, or check the official local sources." }, { headers });
    const relatedIds = result.entry.relatedListingIds;
    const relatedListings = relatedIds.length ? await getPrisma().$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL ROLE gochitral_public`;
      return tx.listing.findMany({ where: { id: { in: relatedIds }, status: "published" }, select: { id: true, title: true, slug: true, category: true }, orderBy: [{ displayOrder: "asc" }, { id: "asc" }], take: 12 });
    }) : [];
    return Response.json({ status: "answered", answer: result.entry.answer, topic: result.entry.topic, sourceTitle: result.entry.sourceTitle,
      sourceUrl: result.entry.sourceUrl, reviewedAt: result.entry.reviewedAt, expiresAt: result.entry.expiresAt,
      relatedTopics: result.relatedTopics, relatedListings, message: "This answer comes from a reviewed local source. Check the source for the latest details." }, { headers });
  } catch {
    return Response.json({ error: "Local answers are temporarily unavailable. Browse the reviewed listings and sources instead." }, { status: 503, headers });
  }
}
