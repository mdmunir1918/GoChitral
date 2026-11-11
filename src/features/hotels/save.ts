import type { Prisma } from "@/generated/prisma/client";
import { hotelSchema } from "./validation";
import { savePublication } from "@/features/publishing/save";
import { reviewDateToday } from "@/features/publishing/validation";

export class HotelConflict extends Error {}

// The supplied transaction uses authenticated RLS, never the operator role.
export async function saveHotel(tx: Prisma.TransactionClient, input: {
  id: string; ownerId: string; version: number; submit: boolean; content: unknown;
}) {
  const content = hotelSchema.parse(input.content);
  const destination = await tx.listing.findFirst({ where: { id: content.destinationId, category: "destinations", status: "published" } });
  if (!destination) throw new Error("Choose a published destination.");
  const { rooms, ...fields } = content;
  const current = await tx.hotelDraft.findUnique({ where: { id: input.id } });
  if (input.version === 0) {
    if (current) throw new HotelConflict();
    await tx.hotelDraft.create({ data: { id: input.id, ownerId: input.ownerId, ...fields } });
  } else {
    const changed = await tx.hotelDraft.updateMany({
      where: { id: input.id, ownerId: input.ownerId, version: input.version },
      data: { ...fields, version: { increment: 1 }, status: "draft" },
    });
    if (changed.count !== 1) throw new HotelConflict();
  }
  // Missing room types are archived, preserving stable IDs for future trip history.
  await tx.hotelRoomDraft.updateMany({ where: { hotelId: input.id, id: { notIn: rooms.map((r) => r.id) } }, data: { archived: true } });
  for (const room of rooms) {
    const existing = await tx.hotelRoomDraft.findUnique({ where: { id: room.id } });
    if (existing && existing.hotelId !== input.id) throw new Error("That room does not belong to this hotel.");
    const data = { title: room.title, capacity: room.capacity, nightlyMinor: Math.round(Number(room.nightlyRate) * 100), availabilityNote: room.availabilityNote, archived: room.archived };
    // A cross-owner ID cannot be read or updated by RLS; the unique key also prevents recreating it.
    if (existing) await tx.hotelRoomDraft.update({ where: { id: room.id, hotelId: input.id }, data });
    else await tx.hotelRoomDraft.create({ data: { id: room.id, hotelId: input.id, ...data } });
  }
  if (input.submit) {
    if (!content.summary || !content.description || !content.contactUrl || !rooms.some((r) => !r.archived)) throw new Error("Add a summary, description, contact website and an active room before submitting.");
    if (!await tx.hotelPhoto.count({ where: { hotelId: input.id, inDraft: true } })) throw new Error("Add at least one hotel photo before submitting.");
    await tx.hotelDraft.update({ where: { id: input.id }, data: { status: "pending", version: { increment: 1 } } });
  }
  return tx.hotelDraft.findUniqueOrThrow({ where: { id: input.id }, select: { id: true, version: true, status: true } });
}

export async function reviewHotel(tx: Prisma.TransactionClient, input: {
  id: string; version: number; approve: boolean; reason: string;
}) {
  const draft = await tx.hotelDraft.findUniqueOrThrow({ where: { id: input.id }, include: { rooms: true, photos: { where: { inDraft: true }, orderBy: { createdAt: "asc" } } } });
  if (draft.version !== input.version || draft.status !== "pending") throw new HotelConflict();
  // Lock the revision before changing either private or public records.
  const changed = await tx.hotelDraft.updateMany({ where: { id: draft.id, version: input.version, status: "pending" }, data: {
    status: input.approve ? "approved" : "changes_requested", reviewNote: input.reason, version: { increment: 1 },
  } });
  if (changed.count !== 1) throw new HotelConflict();
  if (!input.approve) return;
  const cover = draft.photos[0];
  if (!cover || !draft.rooms.some((r) => !r.archived)) throw new Error("A photo and active room are required.");
  const ownership = await tx.hotelOwnership.findUnique({ where: { hotelId: draft.id } });
  if (ownership && ownership.ownerId !== draft.ownerId) throw new Error("Hotel ownership does not match.");
  const current = await tx.listing.findUnique({ where: { id: draft.id } });
  if (current && current.category !== "hotels") throw new Error("This record is not a hotel.");
  if (current?.status === "suspended") throw new Error("Reactivate the public hotel before approving changes.");
  const destination = await tx.listing.findUniqueOrThrow({ where: { id: draft.destinationId } });
  await tx.hotelPhoto.updateMany({ where: { hotelId: draft.id }, data: { approved: false } });
  await tx.hotelPhoto.updateMany({ where: { hotelId: draft.id, inDraft: true }, data: { approved: true } });
  const photoId = `hotel-photo-${cover.id}`;
  await tx.media.upsert({ where: { id: photoId }, create: {
    id: photoId, src: `/api/hotel-photos/${cover.id}`, width: cover.width, height: cover.height,
    alt: draft.title, caption: draft.title, author: draft.title, original: "", license: "owner",
  }, update: {} });
  const slug = current?.slug ?? `${draft.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "hotel"}-${draft.id.slice(0, 8)}`;
  await savePublication(tx, { listingId: draft.id, version: current?.version ?? 0, intent: "publish", reason: input.reason, evidence: "", content: {
    category: "hotels", slug, title: draft.title, location: destination.location, destinationId: draft.destinationId,
    summary: draft.summary, description: draft.description, visitorNote: draft.visitorNote || "Contact the hotel to confirm current availability and prices.",
    contactUrl: draft.contactUrl, photoId, sourceTitle: "Information supplied by the hotel and reviewed by an administrator",
    sourceUrl: draft.contactUrl, reviewed: reviewDateToday(), latitude: "", longitude: "",
  } });
  if (!ownership) await tx.hotelOwnership.create({ data: { hotelId: draft.id, ownerId: draft.ownerId } });
  await tx.hotelDetails.upsert({ where: { hotelId: draft.id }, create: { hotelId: draft.id, amenities: draft.amenities }, update: { amenities: draft.amenities } });
  await tx.room.updateMany({ where: { hotelId: draft.id }, data: { status: "suspended" } });
  for (const room of draft.rooms) {
    const existing = await tx.room.findUnique({ where: { id: room.id } });
    if (existing && existing.hotelId !== draft.id) throw new Error("That room belongs to another hotel.");
    if (room.archived && existing) {
      await tx.room.update({ where: { id: room.id }, data: { status: "suspended" } });
      continue;
    }
    const data = { title: room.title, capacity: room.capacity, nightlyMinor: room.nightlyMinor, availabilityNote: room.availabilityNote, status: room.archived ? "suspended" as const : "published" as const };
    await tx.room.upsert({ where: { id: room.id }, create: { id: room.id, hotelId: draft.id, ...data }, update: data });
  }
  return `/hotels/${slug}`;
}
