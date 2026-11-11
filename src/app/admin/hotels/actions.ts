"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, userDatabase } from "@/lib/auth/session";
import { reviewHotel, HotelConflict } from "@/features/hotels/save";
import { checkPhoto } from "@/lib/storage/r2";
export type HotelReviewResult = { message: string; url?: string };
export async function decideHotel(_previous: HotelReviewResult, form: FormData): Promise<HotelReviewResult> {
  if ((await headers()).get("origin") !== process.env.APP_ORIGIN) return { message: "This request origin is not permitted." };
  const identity = await requireRole("administrator", "/admin/hotels");
  if (!identity) return { message: "Administrator access is required." };
  try {
    const data = z.object({ id: z.uuid(), version: z.coerce.number().int().positive(), intent: z.enum(["approve", "changes"]), reason: z.string().trim().min(1).max(1000) }).parse(Object.fromEntries(form));
    if (data.intent === "approve") {
      const photos = await userDatabase(identity, (tx) => tx.hotelPhoto.findMany({ where: { hotelId: data.id, inDraft: true }, select: { key: true, bytes: true } }));
      for (const photo of photos) {
        const stored = await checkPhoto(photo.key);
        if (stored.ContentType !== "image/webp" || stored.ContentLength !== photo.bytes) throw new Error("A photo is missing or invalid. Ask the manager to upload it again.");
      }
    }
    const url = await userDatabase(identity, (tx) => reviewHotel(tx, { id: data.id, version: data.version, approve: data.intent === "approve", reason: data.reason }));
    for (const path of ["/admin", "/admin/hotels", "/manager/hotels", "/explore", "/sitemap.xml"]) revalidatePath(path);
    revalidatePath("/[category]/[slug]", "page");
    return { message: url ? "Hotel approved and published." : "Changes requested. The manager can edit and resubmit.", url: url || undefined };
  } catch (error) {
    if (error instanceof HotelConflict) return { message: "This submission has changed. Reload it before reviewing." };
    if (error instanceof z.ZodError) return { message: error.issues[0].message };
    return { message: error instanceof Error && !error.message.includes("prisma") && !error.message.includes("Invalid `") ? error.message : "The review could not be saved. Please try again." };
  }
}
