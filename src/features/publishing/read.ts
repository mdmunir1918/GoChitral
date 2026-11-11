import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { contentSchema, type ListingContent } from "./validation";

export async function editorData(tx: Prisma.TransactionClient, id: string) {
  const listing = await tx.listing.findUnique({
    where: { id }, include: { revision: true, verification: true, guideProfile: true, audits: { orderBy: { createdAt: "desc" }, take: 30 } },
  });
  if (!listing) return null;
  const draft = contentSchema.safeParse(listing.revision?.payload);
  const content: ListingContent = draft.success ? draft.data : {
    category: listing.category, slug: listing.slug, title: listing.title, location: listing.location,
    summary: listing.summary, description: listing.description, visitorNote: listing.visitorNote,
    reviewed: listing.reviewed.toISOString().slice(0, 10), photoId: listing.photoId,
    destinationId: listing.destinationId ?? "", sourceTitle: listing.sourceTitle ?? "", sourceUrl: listing.sourceUrl ?? "",
    contactUrl: listing.contactUrl ?? "", latitude: listing.latitude?.toString() ?? "", longitude: listing.longitude?.toString() ?? "",
    servicePrice: listing.servicePriceMinor === null ? "" : (listing.servicePriceMinor / 100).toFixed(2),
    guideLanguages: "", guideExpertise: "", guideAreasServed: "", guideCredentialSummary: "", guidePricingUnit: "per_group_day",
  };
  const draftHasGuideFields = listing.revision?.payload !== null && typeof listing.revision?.payload === "object" &&
    Object.hasOwn(listing.revision.payload, "guideLanguages");
  if (listing.category === "guides" && listing.guideProfile && !draftHasGuideFields) {
    content.guideLanguages = listing.guideProfile.languages.join(", ");
    content.guideExpertise = listing.guideProfile.expertise.join(", ");
    content.guideAreasServed = listing.guideProfile.areasServed.join(", ");
    content.guideCredentialSummary = listing.guideProfile.credentialSummary;
    content.guidePricingUnit = listing.guideProfile.pricingUnit;
  }
  return { listing, content };
}

export async function editorOptions(tx: Prisma.TransactionClient, listingId?: string) {
  const ownedPhotos = listingId ? await tx.hotelPhoto.findMany({ where: { hotelId: listingId, approved: true }, select: { id: true } }) : [];
  const photos = await tx.media.findMany({ where: { OR: [{ license: { not: "owner" } }, { id: { in: ownedPhotos.map((p) => `hotel-photo-${p.id}`) } }] }, select: { id: true, caption: true, author: true }, orderBy: { caption: "asc" } });
  const destinations = await tx.listing.findMany({
    where: { category: "destinations" }, select: { id: true, title: true, status: true }, orderBy: { title: "asc" },
  });
  return { photos, destinations };
}
