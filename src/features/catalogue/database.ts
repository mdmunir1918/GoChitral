import "server-only";
import { z } from "zod";
import { cache } from "react";
import { getPrisma } from "@/lib/prisma";
import type { Listing as StoredListing, Media } from "@/generated/prisma/client";
import type { Listing } from "./types";

const sourceUrl = z.url().refine((url) => url.startsWith("https://"));
const photoSchema = z.object({
  src: z.string().regex(/^(\/images\/[^\s]+|\/api\/hotel-photos\/[a-f0-9-]{36})$/),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string().min(1), caption: z.string(), author: z.string(),
  original: z.string(), license: z.enum(["3.0", "4.0", "owner"]),
}).refine((photo) => photo.license === "owner" ? photo.src.startsWith("/api/hotel-photos/") && photo.original === "" : photo.src.startsWith("/images/") && sourceUrl.safeParse(photo.original).success);
const publicGuideProfileSchema = z.object({ languages: z.array(z.string()), expertise: z.array(z.string()), areasServed: z.array(z.string()),
  credentialSummary: z.string(), pricingUnit: z.literal("per_group_day") });

// Deduplicate metadata/page reads only within one render. Never cache across users
// or requests: publication and suspension changes must be visible immediately.
export const readPublishedListings = cache(async (): Promise<Listing[]> => {
  // SET LOCAL is scoped to this transaction, including on pooled connections.
  return getPrisma().$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL ROLE gochitral_public`;
    // One query replaces separate listing, media, room and count round trips.
    // All joined tables still run under the existing public RLS policies.
    const rows = await tx.$queryRaw<(StoredListing & { photo: Media; roomCount: number | null; fromNightlyMinor: number | null; guideProfile: unknown })[]>`
      SELECT l.*, row_to_json(m) AS photo, r."roomCount", r."fromNightlyMinor",
        CASE WHEN gp."guideId" IS NULL THEN NULL ELSE json_build_object('languages',gp.languages,'expertise',gp.expertise,
          'areasServed',gp."areasServed",'credentialSummary',gp."credentialSummary",'pricingUnit',gp."pricingUnit") END AS "guideProfile"
      FROM public."Listing" l
      JOIN public."Media" m ON m.id = l."photoId"
      LEFT JOIN public."GuideProfile" gp ON gp."guideId"=l.id AND l.category='guides' AND l.status='published'
      LEFT JOIN LATERAL (
        SELECT count(*)::integer AS "roomCount", min("nightlyMinor") AS "fromNightlyMinor"
        FROM public."Room" WHERE "hotelId" = l.id AND status = 'published'
      ) r ON l.category = 'hotels'
      WHERE l.status = 'published' ORDER BY l."displayOrder", l.id`;
    return rows.map((row): Listing => {
      const common = {
        id: row.id, slug: row.slug, title: row.title, location: row.location,
        summary: row.summary, description: row.description, visitorNote: row.visitorNote,
        reviewed: row.reviewed.toISOString().slice(0, 10), status: row.status,
        photo: photoSchema.parse(row.photo),
        contactUrl: row.contactUrl ? sourceUrl.parse(row.contactUrl) : undefined,
        latitude: row.latitude ?? undefined,
        longitude: row.longitude ?? undefined,
        servicePriceMinor: row.servicePriceMinor,
        roomCount: row.category === "hotels" ? row.roomCount ?? 0 : undefined,
        fromNightlyMinor: row.category === "hotels" ? row.fromNightlyMinor ?? undefined : undefined,
        source: row.sourceTitle && row.sourceUrl ? { title: row.sourceTitle, url: sourceUrl.parse(row.sourceUrl) } : undefined,
      };
      if (row.category === "destinations") return { ...common, category: row.category };
      if (!row.destinationId) throw new Error("Invalid catalogue relationship.");
      if (row.category === "guides") return { ...common, category: row.category, destinationId: row.destinationId,
        guideProfile: row.guideProfile ? publicGuideProfileSchema.parse(row.guideProfile) : undefined };
      return { ...common, category: row.category, destinationId: row.destinationId };
    });
  }, { timeout: 10000 });
});

export async function readHotelOverview(id: string) {
  return getPrisma().$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL ROLE gochitral_public`;
    const rooms = await tx.room.findMany({ where: { hotelId: id, status: "published" }, select: { id: true, title: true, capacity: true, nightlyMinor: true, availabilityNote: true }, orderBy: { nightlyMinor: "asc" } });
    const details = await tx.hotelDetails.findUnique({ where: { hotelId: id } });
    const photos = await tx.hotelPhoto.findMany({ where: { hotelId: id, approved: true }, select: { id: true, width: true, height: true }, orderBy: { createdAt: "asc" } });
    return { rooms, amenities: details?.amenities ?? [], photos };
  });
}
