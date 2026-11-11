import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { readPlannerCatalogue } from "@/features/planner/database";
import { quotePlan, type Quote } from "@/features/planner/model";
import { saveTripSchema } from "./validation";

export class TripConflict extends Error { constructor(public tripId: string) { super("A newer version is already saved. Your edits are preserved. Open the saved version before saving again."); } }
export class TripReplayMismatch extends Error { constructor(public tripId: string) { super("This save already completed with different details. Your edits are preserved. Open the saved trip to continue."); } }
export class TripUnavailable extends Error {}
export class TripGuideRequestsDateConflict extends Error {
  constructor(public requests: { id: string; reference: string; status: "pending" | "confirmed"; startDate: Date; endDate: Date }[]) {
    super("Resolve guide requests outside the new trip dates before changing the trip dates.");
  }
}
export class TripValidation extends Error { constructor(message: string, public quote: Quote) { super(message); } }

// Caller supplies an authenticated transaction and its verified account ID.
export async function saveTrip(tx: Prisma.TransactionClient, ownerId: string, raw: unknown) {
  const input = saveTripSchema.parse(raw);
  const { key, ...intent } = input;
  const requestHash = createHash("sha256").update(JSON.stringify(intent)).digest("hex");
  // Serialize the same owner's retry key. The unique receipt remains the durable
  // backstop; validation and all parent/child writes share this transaction.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${ownerId}:${key}`}, 0))`;
  const receipt = await tx.tripSave.findUnique({ where: { ownerId_key: { ownerId, key } } });
  if (receipt) {
    if (receipt.requestHash !== requestHash) throw new TripReplayMismatch(receipt.tripId);
    return { id: receipt.tripId, revision: receipt.revision, replayed: true };
  }
  if (input.tripId) {
    const current = await tx.trip.findUnique({ where: { id: input.tripId } });
    if (!current) throw new TripUnavailable("This trip is unavailable.");
    if (current.revision !== input.revision) throw new TripConflict(current.id);
    const outsideRequests = await tx.guideRequest.findMany({ where: { tripId: current.id, status: { in: ["pending", "confirmed"] },
      OR: [{ startDate: { lt: new Date(input.plan.trip.start) } }, { endDate: { gt: new Date(input.plan.trip.end) } }] },
      select: { id: true, reference: true, status: true, startDate: true, endDate: true } });
    if (outsideRequests.length) throw new TripGuideRequestsDateConflict(outsideRequests as TripGuideRequestsDateConflict["requests"]);
  }
  const catalogue = await readPlannerCatalogue(tx);
  const quote = quotePlan(input.plan, catalogue);
  if (!quote.valid) throw new TripValidation("Some selections are unavailable or need attention. Your choices are still editable.", quote);
  if (quote.lines.some(l => l.changed)) throw new TripValidation("Prices changed since your last review. Review the updated budget before saving.", quote);
  const id = input.tripId ?? randomUUID();
  const revision = input.tripId ? input.revision! + 1 : 1;
  const settings = input.plan.trip;
  const fields = {
    title: input.title, startDate: new Date(settings.start), endDate: new Date(settings.end), people: settings.people,
    destinationIds: settings.destinationIds,
    destinationTitles: settings.destinationIds.map(destination => catalogue.find(l => l.id === destination)!.title),
    budgetMinor: quote.budgetMinor === null ? null : BigInt(quote.budgetMinor),
    knownTotalMinor: BigInt(quote.knownTotalMinor), unknownCount: quote.unknownCount,
  };
  if (input.tripId) {
    const changed = await tx.trip.updateMany({ where: { id, ownerId, revision: input.revision }, data: { ...fields, revision } });
    if (changed.count !== 1) throw new TripConflict(id);
    await tx.tripDay.deleteMany({ where: { tripId: id } });
  } else {
    await tx.trip.create({ data: { id, ownerId, ...fields } });
  }
  const days = quote.days.map(date => ({ id: randomUUID(), tripId: id, date: new Date(date) }));
  await tx.tripDay.createMany({ data: days });
  if (input.plan.items.length) await tx.tripItem.createMany({ data: input.plan.items.map(item => {
    const line = quote.lines.find(l => l.id === item.id)!;
    return {
      tripId: id, dayId: days.find(d => d.date.toISOString().slice(0,10) === item.day)!.id,
      selectionId: item.id, listingId: item.listingId, roomId: item.kind === "hotels" ? item.roomId : null,
      category: item.kind, title: line.title, quantity: item.quantity, unit: line.unit,
      unitMinor: line.unitMinor, nights: line.nights, totalMinor: line.totalMinor === null ? null : BigInt(line.totalMinor), estimated: item.kind === "guides",
    };
  }) });
  await tx.tripSave.create({ data: { ownerId, key, tripId: id, requestHash, revision } });
  return { id, revision, replayed: false };
}
