import "server-only";
import { getPrisma } from "@/lib/prisma";
import type { KnowledgeEntry } from "./knowledge";

export async function readActiveKnowledge(): Promise<KnowledgeEntry[]> {
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  return getPrisma().$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL ROLE gochitral_public`;
    const rows = await tx.knowledgeRule.findMany({
      where: { status: "published", OR: [{ expiresAt: null }, { expiresAt: { gte: today } }] },
      select: { id: true, topic: true, answer: true, terms: true, sourceTitle: true, sourceUrl: true, reviewedAt: true, expiresAt: true, relatedListingIds: true },
      orderBy: [{ topic: "asc" }, { id: "asc" }], take: 200,
    });
    return rows.map((row) => ({ ...row, reviewedAt: row.reviewedAt.toISOString().slice(0, 10), expiresAt: row.expiresAt?.toISOString().slice(0, 10) ?? null }));
  });
}
