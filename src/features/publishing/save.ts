import type { Prisma } from "@/generated/prisma/client";
import { contentSchema, guideProfileFields, listingFields } from "./validation";

export class PublishingConflict extends Error {}

export type PublishingInput = {
  listingId: string; version: number; intent: "save" | "publish" | "suspend" | "reactivate";
  content: unknown; reason: string; evidence: string;
};

// The caller supplies an authenticated transaction. Database policies enforce admin + MFA.
export async function savePublication(tx: Prisma.TransactionClient, input: PublishingInput) {
  await tx.$queryRaw`SELECT set_config('gochitral.action', ${input.intent}, true), set_config('gochitral.reason', ${input.reason}, true)`;
  const current = await tx.listing.findUnique({ where: { id: input.listingId } });
  if ((!current && input.version !== 0) || (current && current.version !== input.version)) throw new PublishingConflict();
  const version = input.version + 1;
  const suspend = input.intent === "suspend";
  if (suspend && current?.status !== "published") throw new Error("Only a published listing can be suspended.");
  if (input.intent === "reactivate" && current?.status !== "suspended") throw new Error("Only a suspended listing can be reactivated.");
  if (input.intent === "publish" && current?.status === "suspended") throw new Error("Use Reactivate to publish this suspended listing.");
  let url: string | undefined;

  if (suspend) {
    const changed = await tx.listing.updateMany({ where: { id: input.listingId, version: input.version }, data: { version, status: "suspended" } });
    if (changed.count !== 1) throw new PublishingConflict();
  } else {
    const content = contentSchema.parse(input.content);
    if (current && (current.category !== content.category || current.slug !== content.slug)) throw new Error("An existing listing keeps its category and URL slug.");
    const photo = await tx.media.findUnique({ where: { id: content.photoId } });
    if (!photo) throw new Error("Choose an approved photograph.");
    if (photo.license === "owner" && (content.category !== "hotels" || !await tx.hotelPhoto.findFirst({
      where: { hotelId: input.listingId, approved: true, id: content.photoId.replace(/^hotel-photo-/, "") },
    }))) throw new Error("Choose a currently approved photo for this hotel.");
    const publish = input.intent === "publish" || input.intent === "reactivate";
    if (publish && (!content.sourceTitle || !content.sourceUrl)) throw new Error("Add the information source title and HTTPS URL before publishing.");
    if (content.category !== "destinations") {
      const destination = await tx.listing.findUnique({ where: { id: content.destinationId } });
      if (destination?.category !== "destinations") throw new Error("Choose a valid destination.");
      if (publish && destination.status !== "published") throw new Error("Publish the parent destination first.");
    }
    const fields = listingFields(content);
    if (current) {
      const changed = await tx.listing.updateMany({
        where: { id: current.id, version: input.version },
        data: publish ? { ...fields, version, status: "published" } : { version },
      });
      if (changed.count !== 1) throw new PublishingConflict();
    } else {
      await tx.listing.create({ data: { id: input.listingId, ...fields, version, status: publish ? "published" : "draft" } });
    }
    await tx.listingRevision.upsert({
      where: { listingId: input.listingId },
      create: { listingId: input.listingId, version, status: publish ? "approved" : "draft", payload: content },
      update: { version, status: publish ? "approved" : "draft", payload: content },
    });
    if (content.category === "guides") {
      await tx.guideVerification.upsert({
        where: { guideId: input.listingId },
        create: { guideId: input.listingId, evidence: input.evidence },
        update: { evidence: input.evidence },
      });
      if (publish) await tx.guideProfile.upsert({
        where: { guideId: input.listingId },
        create: { guideId: input.listingId, ...guideProfileFields(content) },
        update: guideProfileFields(content),
      });
    }
    if (publish) url = `/${content.category}/${content.slug}`;
  }
  // A database trigger appends the audit in the same transaction using the verified session identity.
  return { version, url };
}
