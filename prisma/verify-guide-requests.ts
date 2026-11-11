import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { decideGuideRequest, GuideRequestLimit, GuideRequestMismatch, submitGuideRequest } from "../src/features/guides/requests";

config({ path: [".env.local", ".env"], quiet: true });
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL, max: 8 }) });
const owners = [randomUUID(), randomUUID(), randomUUID()], sessions = owners.map(() => randomUUID());
const guideId = randomUUID(), tripIds = [randomUUID(), randomUUID()];
async function asUser<T>(index: number, action: (tx: Prisma.TransactionClient) => Promise<T>) {
  return db.$transaction(async tx => {
    await tx.$executeRaw`SET LOCAL ROLE authenticated`;
    await tx.$queryRaw`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: owners[index], session_id: sessions[index], role: "authenticated", aal: "aal1", admin_mfa_required: false })}, true)`;
    return action(tx);
  }, { timeout: 30000, maxWait: 20000 });
}
const input = (tripId: string, start: string, end: string, key = randomUUID()) => ({ key, tripId, start, end });
async function verify() {
  const keys = owners.map(owner => createHash("sha256").update(`${owner}:guide-request`).digest("hex"));
  try {
    for (const [index, id] of owners.entries()) {
      await db.account.create({ data: { id, email: `guide-check-${id}@example.invalid`, role: index === 2 ? "administrator" : "tourist" } });
      await db.authSession.create({ data: { id: sessions[index], accountId: id, expiresAt: new Date(Date.now() + 3600000) } });
    }
    const parent = await db.listing.findUniqueOrThrow({ where: { id: "dest-002" } });
    const photoId = parent.photoId;
    await db.listing.create({ data: { id: guideId, category: "guides", slug: `guide-check-${guideId}`, title: "Guide request verification", location: parent.location,
      summary: "Temporary verification guide", description: "Temporary verification guide", visitorNote: "Not a real service", reviewed: new Date(), status: "published",
      photoId, sourceTitle: "Verification", sourceUrl: "https://example.com", destinationId: parent.id, destinationCategory: "destinations", servicePriceMinor: 100000,
      guideProfile: { create: { languages: ["Test English"], expertise: ["Test walking"], areasServed: ["Chitral"], credentialSummary: "Temporary test profile, not real.", pricingUnit: "per_group_day" } } } });
    for (const [index, id] of tripIds.entries()) await db.trip.create({ data: { id, ownerId: owners[index], title: `Guide request trip ${index + 1}`, revision: 1,
      startDate: new Date("2027-06-10"), endDate: new Date("2027-06-20"), people: 2, destinationIds: [parent.id], destinationTitles: [parent.title],
      budgetMinor: null, knownTotalMinor: BigInt(0), unknownCount: 0 } });

    const replayKey = randomUUID(), firstInput = input(tripIds[0], "2027-06-12", "2027-06-13", replayKey);
    const [first, retry] = await Promise.all([
      asUser(0, tx => submitGuideRequest(tx, owners[0], guideId, firstInput)),
      asUser(0, tx => submitGuideRequest(tx, owners[0], guideId, firstInput)),
    ]);
    assert.equal(first.id, retry.id); assert.equal([first.replayed, retry.replayed].filter(value => !value).length, 1);
    await assert.rejects(asUser(0, tx => submitGuideRequest(tx, owners[0], guideId, input(tripIds[0], "2027-06-14", "2027-06-14", replayKey))), GuideRequestMismatch);
    await assert.rejects(asUser(0, tx => submitGuideRequest(tx, owners[0], guideId, input(tripIds[0], "2027-06-09", "2027-06-10"))));
    const second = await asUser(1, tx => submitGuideRequest(tx, owners[1], guideId, input(tripIds[1], "2027-06-13", "2027-06-14")));
    const decisions = await Promise.allSettled([
      asUser(2, tx => decideGuideRequest(tx, first.id, "confirmed", "Guide request verification confirmed.")),
      asUser(2, tx => decideGuideRequest(tx, second.id, "confirmed", "Guide request verification confirmed.")),
    ]);
    assert.equal(decisions.filter(result => result.status === "fulfilled" && result.value === true).length, 1,
      "Concurrent confirmations for overlapping service dates must have exactly one winner.");
    assert.equal(decisions.filter(result => result.status === "rejected").length, 1);
    const winner = await db.guideRequest.findFirstOrThrow({ where: { id: { in: [first.id, second.id] }, status: "confirmed" } });
    const loser = winner.id === first.id ? second : first;
    const deniedUpdate = await asUser(0, tx => tx.guideRequest.updateMany({ where: { id: loser.id }, data: { status: "declined" } }));
    assert.equal(deniedUpdate.count, 0, "A tourist cannot change a guide request decision.");
    assert.equal(await asUser(0, tx => tx.guideRequest.findUnique({ where: { id: second.id } })), null, "A different tourist cannot read this request.");
    await assert.rejects(db.$transaction(async tx => { await tx.$executeRaw`SET LOCAL ROLE gochitral_public`; await tx.guideRequest.findMany(); }));
    await assert.rejects(asUser(0, tx => tx.trip.update({ where: { id: tripIds[0] }, data: { endDate: new Date("2027-06-12"), revision: 2 } })));

    const adjacent = await asUser(0, tx => submitGuideRequest(tx, owners[0], guideId, input(tripIds[0], "2027-06-15", "2027-06-15")));
    assert.equal(await asUser(2, tx => decideGuideRequest(tx, adjacent.id, "confirmed", "Adjacent date verification confirmed.")), true);
    const declined = await asUser(0, tx => submitGuideRequest(tx, owners[0], guideId, input(tripIds[0], "2027-06-16", "2027-06-16")));
    assert.equal(await asUser(2, tx => decideGuideRequest(tx, declined.id, "declined", "Temporary decline verification.")), true);
    assert.equal((await asUser(0, tx => tx.guideRequest.findUnique({ where: { id: declined.id } })))?.status, "declined");

    // Eight real requests per 15-minute window are allowed; the ninth is stopped.
    for (let day = 16; day <= 20; day++) await asUser(0, tx => submitGuideRequest(tx, owners[0], guideId,
      input(tripIds[0], `2027-06-${day}`, `2027-06-${day}`)));
    await assert.rejects(asUser(0, tx => submitGuideRequest(tx, owners[0], guideId, input(tripIds[0], "2027-06-20", "2027-06-20"))), GuideRequestLimit);
    const audits = await db.guideRequestAudit.count({ where: { requestId: { in: [first.id, second.id, adjacent.id, declined.id] } } });
    assert.equal(audits, 3);
    const [profile, requestCount] = await asUser(2, async tx => [await tx.guideProfile.findUnique({ where: { guideId } }), await tx.guideRequest.count()]);
    assert(profile); assert.equal(requestCount, 9);
    console.log("Guide requests: idempotent retries, trip ownership/date bounds, owner/admin isolation, private refs, overlapping concurrent confirmation, adjacent dates, pending-only decisions, audit history, declined history and eight-per-15-minute limit passed.");
  } finally {
    await db.guideRequest.deleteMany({ where: { ownerId: { in: owners } } });
    await db.trip.deleteMany({ where: { id: { in: tripIds } } });
    await db.listing.deleteMany({ where: { id: guideId } });
    await db.authRateLimit.deleteMany({ where: { key: { in: keys } } });
    await db.account.deleteMany({ where: { id: { in: owners } } });
    await db.$disconnect();
    console.log("Temporary guide requests, profile, trips, sessions, accounts and rate-limit rows removed.");
  }
}
verify();
