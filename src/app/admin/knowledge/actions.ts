"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, userDatabase } from "@/lib/auth/session";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
});
const schema = z.object({
  id: z.string().max(36), version: z.coerce.number().int().min(0).max(2_147_483_646),
  topic: z.string().trim().min(3).max(120), answer: z.string().trim().min(10).max(2500),
  terms: z.string().max(2000), sourceTitle: z.string().trim().min(3).max(180), sourceUrl: z.url().refine((url) => url.startsWith("https://"), "Use a secure https:// source."),
  reviewedAt: date, expiresAt: z.union([z.literal(""), date]), relatedListingIds: z.string().max(1500),
  status: z.enum(["draft", "published", "retired"]), reason: z.string().trim().min(3).max(500),
});
function fail(code: string): never { redirect(`/admin/knowledge?result=${code}`); }

export async function saveKnowledge(form: FormData): Promise<void> {
  if ((await headers()).get("origin") !== process.env.APP_ORIGIN) fail("origin");
  const identity = await requireRole("administrator", "/admin/knowledge");
  if (!identity) fail("denied");
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) fail("invalid");
  const data = parsed.data;
  const terms = [...new Set(data.terms.split(/[\n,]+/).map((term) => term.trim()).filter(Boolean))];
  const relatedListingIds = [...new Set(data.relatedListingIds.split(/[\n,]+/).map((id) => id.trim()).filter(Boolean))];
  if (!terms.length || terms.length > 24 || terms.some((term) => term.length < 3 || term.length > 80) || relatedListingIds.length > 12) fail("invalid");
  const expiresAt = data.expiresAt ? new Date(`${data.expiresAt}T00:00:00.000Z`) : null;
  const reviewedAt = new Date(`${data.reviewedAt}T00:00:00.000Z`);
  const today = new Date().toISOString().slice(0, 10);
  if (expiresAt && expiresAt < reviewedAt || data.status === "published" && expiresAt && data.expiresAt < today) fail("dates");
  const id = data.id || randomUUID();
  try {
    await userDatabase(identity, async (tx) => {
      if (relatedListingIds.length) {
        const published = await tx.listing.findMany({ where: { id: { in: relatedListingIds }, status: "published" }, select: { id: true } });
        if (published.length !== relatedListingIds.length) throw new Error("related-listing");
      }
      const current = data.id ? await tx.knowledgeRule.findUnique({ where: { id }, select: { version: true, status: true } }) : null;
      if (data.id && (!current || current.version !== data.version)) throw new Error("conflict");
      const version = current ? current.version + 1 : 1;
      const content = { topic: data.topic, answer: data.answer, terms, sourceTitle: data.sourceTitle, sourceUrl: data.sourceUrl,
        reviewedAt, expiresAt, relatedListingIds, status: data.status, version };
      if (current) {
        const changed = await tx.knowledgeRule.updateMany({ where: { id, version: current.version }, data: content });
        if (!changed.count) throw new Error("conflict");
      } else await tx.knowledgeRule.create({ data: { id, ...content } });
      const action = !current ? "created" : current.status !== data.status && data.status === "published" ? "published" : data.status === "retired" ? "retired" : "updated";
      await tx.knowledgeRuleAudit.create({ data: { ruleId: id, actorId: identity.user.id, action, reason: data.reason, version } });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "related-listing") fail("related");
    if (error instanceof Error && error.message === "conflict") fail("conflict");
    fail("save-error");
  }
  revalidatePath("/admin/knowledge"); revalidatePath("/recommendations");
  redirect(`/admin/knowledge?result=${data.status}`);
}
