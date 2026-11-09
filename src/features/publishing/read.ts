import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { contentSchema, type ListingContent } from "./validation";

export async function editorData(tx: Prisma.TransactionClient, id: string) {
  const listing = await tx.listing.findUnique({
    where: { id }, include: { revision: true, verification: true, audits: { orderBy: { createdAt: "desc" }, take: 30 } },
  });
  if (!listing) return null;
  const draft = contentSchema.safeParse(listing.revision?.payload);
  const content: ListingContent = draft.success ? draft.data : {
    category: listing.category, slug: listing.slug, title: listing.title, location: listing.location,
    summary: listing.summary, description: listing.description, visitorNote: listing.visitorNote,
    reviewed: listing.reviewed.toISOString().slice(0, 10), photoId: listing.photoId,
    destinationId: listing.destinationId ?? "", sourceTitle: listing.sourceTitle ?? "", sourceUrl: listing.sourceUrl ?? "",
    contactUrl: listing.contactUrl ?? "", latitude: listing.latitude?.toString() ?? "", longitude: listing.longitude?.toString() ?? "",
  };
  return { listing, content };
}

export async function editorOptions(tx: Prisma.TransactionClient) {
  const photos = await tx.media.findMany({ select: { id: true, caption: true, author: true }, orderBy: { caption: "asc" } });
  const destinations = await tx.listing.findMany({
    where: { category: "destinations" }, select: { id: true, title: true, status: true }, orderBy: { title: "asc" },
  });
  return { photos, destinations };
}
