import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { readPlannerCatalogue } from "@/features/planner/database";
import { newDraft, type DeviceDraft } from "@/features/planner/model";

export async function readSavedTrip(tx: Prisma.TransactionClient, id: string) {
  const trip = await tx.trip.findUnique({
    where: { id },
    include: {
      days: { orderBy: { date: "asc" }, include: { items: { orderBy: { id: "asc" } } } },
      guideRequests: { orderBy: { createdAt: "desc" }, include: { guide: { select: { title: true } } } },
    },
  });
  if (!trip) return null;
  const catalogue = await readPlannerCatalogue(tx);
  const available = new Set<string>();
  for (const day of trip.days) for (const item of day.items) {
    const listing = catalogue.find(l => l.id === item.listingId && l.category === item.category);
    if (listing && (item.category !== "hotels" || listing.rooms.some(r => r.id === item.roomId))) available.add(item.id);
  }
  return { trip, available, catalogue };
}
export type SavedTrip = NonNullable<Awaited<ReturnType<typeof readSavedTrip>>>;
export function tripDraft(saved: SavedTrip): DeviceDraft {
  const trip = saved.trip;
  return {
    ...newDraft(trip.startDate.toISOString().slice(0,10)), title: trip.title, editing: { id: trip.id, revision: trip.revision },
    trip: {
      start: trip.startDate.toISOString().slice(0,10), end: trip.endDate.toISOString().slice(0,10), people: trip.people,
      destinationIds: trip.destinationIds, budget: trip.budgetMinor === null ? "" : (Number(trip.budgetMinor) / 100).toFixed(2),
    },
    items: trip.days.flatMap(day => day.items.map(item => ({
      id: item.selectionId, day: day.date.toISOString().slice(0,10), kind: item.category,
      listingId: item.listingId, ...(item.roomId ? { roomId: item.roomId } : {}), quantity: item.quantity, previousUnitMinor: item.unitMinor,
    }))),
  };
}
