"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, userDatabase } from "@/lib/auth/session";
import { contentSchema, type EditorResult } from "@/features/publishing/validation";
import { savePublication, PublishingConflict } from "@/features/publishing/save";
import { Prisma } from "@/generated/prisma/client";

const commandSchema = z.object({
  listingId: z.string().max(100),
  version: z.coerce.number().int().min(0).max(2147483646),
  intent: z.enum(["save", "publish", "suspend", "reactivate"]),
  reason: z.string().trim().min(1, "Give a reason for this change.").max(1000),
  evidence: z.string().trim().max(10000),
});

export async function moderate(previous: EditorResult, form: FormData): Promise<EditorResult> {
  if ((await headers()).get("origin") !== process.env.APP_ORIGIN) return { ...previous, message: "This request origin is not permitted." };
  const identity = await requireRole("administrator", "/admin");
  if (!identity) return { ...previous, message: "Administrator access is required." };
  const command = commandSchema.safeParse(Object.fromEntries(form));
  if (!command.success) return { ...previous, message: command.error.issues[0].message };
  const content = command.data.intent === "suspend" ? undefined : contentSchema.safeParse(Object.fromEntries(form));
  if (content && !content.success) return { ...previous, message: content.error.issues[0].message };
  const listingId = command.data.listingId || randomUUID();
  try {
    const result = await userDatabase(identity, (tx) => savePublication(tx, {
      ...command.data, listingId, content: content?.success ? content.data : undefined,
    }));
    revalidatePath("/explore");
    revalidatePath("/admin");
    revalidatePath("/admin/listings/[id]", "page");
    revalidatePath("/[category]/[slug]", "page");
    revalidatePath("/sitemap.xml");
    return {
      listingId, version: result.version, url: result.url,
      status: command.data.intent === "suspend" ? "suspended" : result.url ? "published" : previous.status ?? "draft",
      message: result.url ? `Published revision ${result.version}.` : command.data.intent === "suspend" ? "Listing suspended." : `Draft revision ${result.version} saved.`,
    };
  } catch (error) {
    if (error instanceof PublishingConflict) return {
      ...previous, conflict: true, url: undefined,
      message: "Another tab changed this listing. Your unsaved text is preserved. Reload the saved version before trying again.",
    };
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return { ...previous, message: error.code === "P2002" ? "That URL slug is already in use. Choose another." : "The change could not be saved. Your text is preserved. Please try again." };
    }
    return { ...previous, message: error instanceof Error ? error.message : "The change could not be saved." };
  }
}
