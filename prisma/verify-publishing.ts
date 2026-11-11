import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { savePublication, PublishingConflict } from "../src/features/publishing/save";
import { contentSchema, type ListingContent } from "../src/features/publishing/validation";

config({ path: [".env.local", ".env"], quiet: true });
if (!process.env.DIRECT_URL) throw new Error("Set DIRECT_URL for the development database.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }) });
class RollbackSuccess extends Error {}

async function verify() {
  try {
    await prisma.$transaction(async (tx) => {
      const admin = randomUUID(), tourist = randomUUID();
      const sessions = [randomUUID(), randomUUID()];
      for (const [index, id] of [admin, tourist].entries()) {
        await tx.$executeRaw`INSERT INTO public."Account" (id, email) VALUES (${id}::uuid, ${`publishing-${id}@example.invalid`})`;
        await tx.$executeRaw`INSERT INTO public."AuthSession" (id, "accountId", "expiresAt", "mfaVerifiedAt") VALUES (${sessions[index]}::uuid, ${id}::uuid, now() + interval '1 day', now())`;
      }
      await tx.$executeRaw`UPDATE "Account" SET role = 'administrator' WHERE id = ${admin}::uuid`;
      const photo = await tx.media.findFirstOrThrow();
      const content: ListingContent = {
        category: "destinations", slug: `publishing-${randomUUID()}`, title: "Publishing verification valley",
        location: "Development", summary: "Development verification", description: "A development test record.",
        visitorNote: "Development record.", reviewed: new Date().toISOString().slice(0, 10), photoId: photo.id,
        destinationId: "", sourceTitle: "Development source", sourceUrl: "https://example.com",
        contactUrl: "", latitude: "", longitude: "",
        guideLanguages: "", guideExpertise: "", guideAreasServed: "", guideCredentialSummary: "", guidePricingUnit: "per_group_day",
      };
      const id = randomUUID();
      async function adminRole(aal = "aal2") {
        await tx.$executeRaw`SET LOCAL ROLE authenticated`;
        await tx.$queryRaw`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: admin, session_id: sessions[0], role: "authenticated", aal })}, true)`;
      }
      async function publicListing() {
        await tx.$executeRaw`SET LOCAL ROLE gochitral_public`;
        return tx.listing.findUnique({ where: { id } });
      }
      await adminRole();
      const command = { listingId: id, content, reason: "Publishing regression check", evidence: "" };
      await savePublication(tx, { ...command, version: 0, intent: "save" });
      assert.equal(await publicListing(), null);
      await adminRole();
      await savePublication(tx, { ...command, version: 1, intent: "publish" });
      assert.equal((await publicListing())?.title, content.title);
      await adminRole();
      const children: string[] = [];
      for (const category of ["activities", "hotels", "guides"] as const) {
        const child = randomUUID();
        children.push(child);
        await savePublication(tx, {
          ...command, listingId: child, version: 0, intent: "publish", evidence: "Private review evidence",
          content: { ...content, category, slug: `publishing-${child}`, destinationId: id, ...(category === "guides" ? {
            guideLanguages: "Khowar, Urdu", guideExpertise: "Temporary verification", guideAreasServed: "Chitral town",
            guideCredentialSummary: "Fictional test profile", guidePricingUnit: "per_group_day" as const,
          } : {}) },
        });
      }
      assert.equal((await tx.guideVerification.findUniqueOrThrow({ where: { guideId: children[2] } })).evidence, "Private review evidence");
      const edited = { ...content, title: "Pending edited valley" };
      await savePublication(tx, { ...command, content: edited, version: 2, intent: "save" });
      assert.equal((await publicListing())?.title, content.title, "Draft edits must not replace approved content.");
      await adminRole();
      await assert.rejects(savePublication(tx, { ...command, version: 2, intent: "publish" }), PublishingConflict);
      assert.equal(await tx.auditEntry.count({ where: { listingId: id } }), 3);
      await savePublication(tx, { ...command, content: edited, version: 3, intent: "publish" });
      assert.equal((await publicListing())?.title, edited.title);
      await adminRole();
      await savePublication(tx, { ...command, version: 4, intent: "suspend" });
      assert.equal(await publicListing(), null);
      assert.equal(await tx.listing.count({ where: { id: { in: children } } }), 0);
      await adminRole();
      await savePublication(tx, { ...command, content: edited, version: 5, intent: "reactivate" });
      assert.equal((await publicListing())?.status, "published");
      assert.equal(await tx.listing.count({ where: { id: { in: children } } }), 3);
      await adminRole();
      const audit = await tx.auditEntry.findMany({ where: { listingId: id }, orderBy: { revision: "asc" } });
      assert.deepEqual(audit.map((entry) => entry.action), ["save", "publish", "save", "publish", "suspend", "reactivate"]);
      assert(audit.every((entry) => entry.actorId === admin && entry.reason === command.reason));
      await adminRole("aal1");
      assert.equal(await tx.listingRevision.count({ where: { listingId: id } }), 0);
      await tx.$executeRaw`RESET ROLE`;
      await tx.authSession.update({ where: { id: sessions[0] }, data: { mfaVerifiedAt: null } });
      await adminRole("aal2");
      assert.equal(await tx.listingRevision.count({ where: { listingId: id } }), 0, "A claim alone cannot replace database MFA verification.");
      await tx.$queryRaw`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: admin, session_id: sessions[0], role: "authenticated", aal: "aal1", admin_mfa_required: false })}, true)`;
      await savePublication(tx, { ...command, content: edited, version: 6, intent: "save" });
      assert.equal(await tx.auditEntry.count({ where: { listingId: id } }), 7, "Local password-only admins can save with an audit record.");
      await tx.$executeRaw`RESET ROLE`;
      await tx.authSession.update({ where: { id: sessions[0] }, data: { revokedAt: new Date() } });
      await tx.$executeRaw`SET LOCAL ROLE authenticated`;
      assert.equal(await tx.listingRevision.count({ where: { listingId: id } }), 0, "Local MFA opt-out cannot bypass session revocation.");
      await tx.$executeRaw`SET LOCAL ROLE authenticated`;
      await tx.$queryRaw`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: tourist, session_id: sessions[1], role: "authenticated", aal: "aal1", admin_mfa_required: false })}, true)`;
      assert.equal(await tx.auditEntry.count(), 0);
      assert.equal((await tx.listing.updateMany({ where: { id }, data: { title: "Unauthorized" } })).count, 0);
      assert.equal(contentSchema.safeParse({ ...content, contactUrl: "javascript:alert(1)" }).success, false);
      assert.equal(contentSchema.safeParse({ ...content, latitude: "91", longitude: "0" }).success, false);
      assert.equal(contentSchema.safeParse({ ...content, latitude: "20", longitude: "" }).success, false);
      throw new RollbackSuccess();
    }, { timeout: 120000, maxWait: 15000 });
  } catch (error) {
    if (!(error instanceof RollbackSuccess)) throw error;
  } finally { await prisma.$disconnect(); }
  console.log("Draft/public isolation, publish, stale save, suspension, reactivation, audit ordering, MFA denial, tourist denial and validation passed. Fixtures rolled back.");
}
verify();
