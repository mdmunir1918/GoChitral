import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

export const guideRequestInput = z.object({
  key: z.uuid(), tripId: z.uuid(), start: z.iso.date(), end: z.iso.date(),
}).refine(value => value.end >= value.start && (Date.parse(value.end) - Date.parse(value.start)) / 86400000 < 31, {
  message: "Choose up to 31 inclusive service days.", path: ["end"],
});

export class GuideRequestMismatch extends Error {}
export class GuideRequestLimit extends Error {}
export class GuideRequestUnavailable extends Error {}
export class GuideRequestDateConflict extends Error {
  constructor(public requests: { id: string; reference: string; status: string; startDate: Date; endDate: Date }[]) {
    super("Resolve guide requests outside the new trip dates before changing the trip dates.");
  }
}

export async function submitGuideRequest(tx: Prisma.TransactionClient, ownerId: string, guideId: string, raw: unknown) {
  const input = guideRequestInput.parse(raw);
  const intent = { guideId, tripId: input.tripId, start: input.start, end: input.end };
  const requestHash = createHash("sha256").update(JSON.stringify(intent)).digest("hex");
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${ownerId}:${input.key}`}, 0))`;
  const existing = await tx.guideRequest.findUnique({ where: { ownerId_key: { ownerId, key: input.key } } });
  if (existing) {
    if (existing.requestHash !== requestHash) throw new GuideRequestMismatch("This request token was already used for different details.");
    return { id: existing.id, reference: existing.reference, status: existing.status, replayed: true };
  }
  const trip = await tx.trip.findFirst({ where: { id: input.tripId, ownerId }, select: { id: true, startDate: true, endDate: true } });
  if (!trip) throw new GuideRequestUnavailable("Choose one of your saved trips.");
  const guide = await tx.listing.findFirst({ where: { id: guideId, category: "guides", status: "published", guideProfile: { isNot: null } },
    select: { id: true, title: true, servicePriceMinor: true, guideProfile: { select: { pricingUnit: true } } } });
  if (!guide?.guideProfile) throw new GuideRequestUnavailable("This guide is not available for requests.");
  if (input.start < trip.startDate.toISOString().slice(0, 10) || input.end > trip.endDate.toISOString().slice(0, 10)) {
    throw new Error("Choose service dates inside your saved trip dates.");
  }
  const allowed = await tx.$queryRaw<{ allowed: boolean }[]>`SELECT public.gochitral_guide_request_attempt() AS allowed`;
  if (!allowed[0]?.allowed) throw new GuideRequestLimit("You have reached the guide request limit. Try again in 15 minutes.");
  const reference = `GC-${randomBytes(4).toString("hex").toUpperCase()}`;
  const request = await tx.guideRequest.create({ data: { reference, ownerId, guideId, guideTitle: guide.title, tripId: trip.id,
    startDate: new Date(input.start), endDate: new Date(input.end), priceMinor: guide.servicePriceMinor,
    pricingUnit: guide.guideProfile.pricingUnit, key: input.key, requestHash } });
  return { id: request.id, reference: request.reference, status: request.status, replayed: false };
}

export async function decideGuideRequest(tx: Prisma.TransactionClient, requestId: string, decision: "confirmed" | "declined", reason: string) {
  await tx.$queryRaw`SELECT set_config('gochitral.guide_reason', ${reason}, true)`;
  const result = await tx.guideRequest.updateMany({ where: { id: requestId, status: "pending" }, data: { status: decision } });
  return result.count === 1;
}
