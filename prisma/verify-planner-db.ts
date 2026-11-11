import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { savePublication } from "../src/features/publishing/save";
import { quotePlan, type PlannerListing } from "../src/features/planner/model";
config({ path: [".env.local", ".env"], quiet: true });
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }) });
class Rollback extends Error {}
async function verify() {
  try {
    await db.$transaction(async tx => {
      const admin = randomUUID(), sid = randomUUID(), id = randomUUID();
      await tx.account.create({ data: { id: admin, email: `planner-${admin}@example.invalid`, role: "administrator" } });
      await tx.authSession.create({ data: { id: sid, accountId: admin, expiresAt: new Date(Date.now() + 60000), mfaVerifiedAt: new Date() } });
      const parent = await tx.listing.findFirstOrThrow({ where: { category: "destinations", status: "published" } });
      const photo = await tx.media.findFirstOrThrow({ where: { license: { not: "owner" } } });
      const content = { category: "activities" as const, slug: `planner-${id}`, title: "Planner test activity", location: parent.location, summary: "Test only", description: "Test only", visitorNote: "Test only", reviewed: new Date().toISOString().slice(0,10), photoId: photo.id, destinationId: parent.id, sourceTitle: "Test", sourceUrl: "https://example.com", contactUrl: "", latitude: "", longitude: "", servicePrice: "1500.00" };
      async function adminRole() {
        await tx.$executeRaw`SET LOCAL ROLE authenticated`;
        await tx.$queryRaw`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: admin, session_id: sid, role: "authenticated", aal: "aal2" })}, true)`;
      }
      async function publicItem() {
        await tx.$executeRaw`SET LOCAL ROLE gochitral_public`;
        return tx.listing.findUnique({ where: { id } });
      }
      await adminRole(); await savePublication(tx, { listingId: id, version: 0, intent: "publish", content, reason: "Planner price verification", evidence: "" });
      assert.equal((await publicItem())?.servicePriceMinor, 150000);
      await adminRole(); await savePublication(tx, { listingId: id, version: 1, intent: "save", content: { ...content, servicePrice: "2000" }, reason: "Private price draft", evidence: "" });
      assert.equal((await publicItem())?.servicePriceMinor, 150000, "Draft price edits must not change public estimates.");
      await adminRole(); await savePublication(tx, { listingId: id, version: 2, intent: "publish", content: { ...content, servicePrice: "2000" }, reason: "Approve changed price", evidence: "" });
      const current = await publicItem(); assert.equal(current?.servicePriceMinor, 200000);
      const catalog: PlannerListing[] = [{ id: parent.id, title: parent.title, category: "destinations", destinationId: null, servicePriceMinor: null, rooms: [] }, { id, title: current!.title, category: "activities", destinationId: parent.id, servicePriceMinor: current!.servicePriceMinor, rooms: [] }];
      const quote = quotePlan({ trip: { start: "2027-06-10", end: "2027-06-10", people: 2, destinationIds: [parent.id], budget: "" }, items: [{ id: randomUUID(), listingId: id, kind: "activities", day: "2027-06-10", quantity: 2, previousUnitMinor: 150000 }] }, catalog);
      assert.equal(quote.knownTotalMinor, 400000); assert.equal(quote.lines[0].changed, true);
      await adminRole(); await savePublication(tx, { listingId: id, version: 3, intent: "suspend", content: undefined, reason: "Withdraw test activity", evidence: "" });
      assert.equal(await publicItem(), null);
      throw new Rollback();
    }, { timeout: 120000 });
  } catch (error) { if (!(error instanceof Rollback)) throw error; }
  finally { await db.$disconnect(); }
  console.log("Planner database checks: published prices, private draft isolation, approved price change, current quote and suspension passed. Fixtures rolled back.");
}
verify();
