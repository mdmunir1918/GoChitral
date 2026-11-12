import "server-only";
import { getPrisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { PlannerListing } from "./model";

export async function readPlannerCatalogue(transaction?: Prisma.TransactionClient): Promise<PlannerListing[]> {
  const read = async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw`SET LOCAL ROLE gochitral_public`;
    const rows = await tx.$queryRaw<(Omit<PlannerListing, "reviewed"> & { reviewed: Date })[]>`
      SELECT l.id, l.title, l.category, l."destinationId", l."servicePriceMinor", l.summary, l.description,
        l.latitude, l.longitude, l.location, l."visitorNote", l.reviewed,
        COALESCE((SELECT json_agg(json_build_object('id', r.id, 'title', r.title,
          'capacity', r.capacity, 'nightlyMinor', r."nightlyMinor") ORDER BY r."nightlyMinor", r.id)
          FROM public."Room" r WHERE r."hotelId" = l.id AND r.status = 'published'), '[]'::json) AS rooms
      FROM public."Listing" l WHERE l.status = 'published' ORDER BY l.title, l.id`;
    return rows.map((row) => ({ ...row, reviewed: row.reviewed.toISOString().slice(0, 10) }));
  };
  if (transaction) {
    const rows = await read(transaction);
    await transaction.$executeRaw`SET LOCAL ROLE authenticated`;
    return rows;
  }
  return getPrisma().$transaction(read);
}
