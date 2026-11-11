"use server";
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, userDatabase } from "@/lib/auth/session";
import { saveHotel, HotelConflict } from "@/features/hotels/save";
import { hotelSchema, type HotelResult } from "@/features/hotels/validation";
export async function saveHotelDraft(previous: HotelResult, form: FormData): Promise<HotelResult> {
  if ((await headers()).get("origin") !== process.env.APP_ORIGIN) return { ...previous, message: "This request origin is not permitted." };
  const identity = await requireRole("manager", "/manager/hotels");
  if (!identity) return { ...previous, message: "A hotel manager account is required." };
  try {
    const id = form.get("id") ? z.uuid().parse(form.get("id")) : randomUUID();
    const version = z.coerce.number().int().min(0).parse(form.get("version"));
    const intent = z.enum(["save", "submit"]).parse(form.get("intent"));
    const content = hotelSchema.parse(JSON.parse(z.string().max(100000).parse(form.get("content"))));
    const result = await userDatabase(identity, (tx) => saveHotel(tx, { id, ownerId: identity.user.id, version, submit: intent === "submit", content }));
    revalidatePath("/manager/hotels"); revalidatePath("/admin/hotels");
    return { ...result, message: intent === "submit" ? "Submitted for admin review. Your public listing changes only after approval." : "Draft saved." };
  } catch (error) {
    if (error instanceof HotelConflict) return { ...previous, conflict: true, message: "Another tab changed this hotel. Your edits are preserved. Reload before saving again." };
    if (error instanceof z.ZodError) return { ...previous, message: error.issues[0].message };
    return { ...previous, message: error instanceof Error && !error.message.includes("prisma") && !error.message.includes("Invalid `") ? error.message : "The hotel could not be saved. Check the details and try again." };
  }
}
export async function removeHotelPhoto(id: string) {
  if ((await headers()).get("origin") !== process.env.APP_ORIGIN) return false;
  const identity = await requireRole("manager", "/manager/hotels");
  if (!identity || !z.uuid().safeParse(id).success) return false;
  try { const result = await userDatabase(identity, (tx) => tx.hotelPhoto.updateMany({ where: { id, inDraft: true }, data: { inDraft: false } })); return result.count === 1; } catch { return false; }
}
