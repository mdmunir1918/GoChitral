import "server-only";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import type { Listing } from "./types";

const sourceUrl = z.url().refine((url) => url.startsWith("https://"));
const photoSchema = z.object({
  src: z.string().startsWith("/images/"),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string().min(1), caption: z.string(), author: z.string(),
  original: sourceUrl, license: z.enum(["3.0", "4.0"]),
});

export async function readPublishedListings(): Promise<Listing[]> {
  // SET LOCAL is scoped to this transaction, including on pooled connections.
  return getPrisma().$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL ROLE gochitral_public`;
    const rows = await tx.listing.findMany({
      where: { status: "published" },
      include: { photo: true },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    });
    return rows.map((row): Listing => {
      const common = {
        id: row.id, slug: row.slug, title: row.title, location: row.location,
        summary: row.summary, description: row.description, visitorNote: row.visitorNote,
        reviewed: row.reviewed.toISOString().slice(0, 10), status: row.status,
        photo: photoSchema.parse(row.photo),
        contactUrl: row.contactUrl ? sourceUrl.parse(row.contactUrl) : undefined,
        latitude: row.latitude ?? undefined,
        longitude: row.longitude ?? undefined,
        source: row.sourceTitle && row.sourceUrl ? { title: row.sourceTitle, url: sourceUrl.parse(row.sourceUrl) } : undefined,
      };
      if (row.category === "destinations") return { ...common, category: row.category };
      if (!row.destinationId) throw new Error("Invalid catalogue relationship.");
      return { ...common, category: row.category, destinationId: row.destinationId };
    });
  }, { timeout: 10000 });
}
