import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { saveTrip, TripConflict, TripReplayMismatch, TripValidation } from "../src/features/trips/save";
import { readSavedTrip } from "../src/features/trips/read";
import { returnPath } from "../src/lib/auth/return-path";
config({ path: [".env.local", ".env"], quiet: true });
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL, max: 5 }) });
const owners = [randomUUID(), randomUUID(), randomUUID()], sessions = owners.map(() => randomUUID());
const listingIds = [randomUUID(), randomUUID(), randomUUID()], roomId = randomUUID();

async function asOwner<T>(index: number, action: (tx: Prisma.TransactionClient) => Promise<T>) {
  return db.$transaction(async tx => {
    await tx.$executeRaw`SET LOCAL ROLE authenticated`;
    await tx.$queryRaw`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: owners[index], session_id: sessions[index], role: "authenticated", aal: "aal1", admin_mfa_required: false })}, true)`;
    return action(tx);
  }, { timeout: 120000, maxWait: 30000 });
}
async function verify() {
  try {
    for (const [index,id] of owners.entries()) {
      await db.account.create({ data: { id, email: `trip-check-${id}@example.invalid`, role: index === 2 ? "administrator" : "tourist" } });
      await db.authSession.create({ data: { id: sessions[index], accountId: id, expiresAt: new Date(Date.now() + 3600000) } });
    }
    const parent = await db.listing.findUniqueOrThrow({ where: { id: "dest-002" } });
    for (const [index, category] of (["hotels", "activities", "guides"] as const).entries()) await db.listing.create({ data: {
      id: listingIds[index], slug: `trip-check-${listingIds[index]}`, category, title: `Trip verification ${category}`, location: parent.location,
      summary: "Temporary trip test", description: "Temporary trip test", visitorNote: "Not a real offer", reviewed: new Date(), status: "published",
      photoId: parent.photoId, sourceTitle: "Trip test", sourceUrl: "https://example.com", destinationId: parent.id, destinationCategory: "destinations",
      servicePriceMinor: category === "activities" ? 150000 : null,
    } });
    await db.room.create({ data: { id: roomId, hotelId: listingIds[0], title: "Verification double", capacity: 2, nightlyMinor: 600000, status: "published" } });
    const plan = { trip: { start: "2027-06-10", end: "2027-06-12", people: 2, destinationIds: [parent.id], budget: "20000" }, items: [
      ...["2027-06-10", "2027-06-11"].map(day => ({ id: randomUUID(), day, kind: "hotels" as const, listingId: listingIds[0], roomId, quantity: 1, previousUnitMinor: 600000 })),
      { id: randomUUID(), day: "2027-06-10", kind: "activities" as const, listingId: listingIds[1], quantity: 2, previousUnitMinor: 150000 },
      { id: randomUUID(), day: "2027-06-12", kind: "guides" as const, listingId: listingIds[2], quantity: 1, previousUnitMinor: null },
    ] };
    const input = { key: randomUUID(), title: "Trip verification itinerary", plan };
    const first = await asOwner(0, tx => saveTrip(tx, owners[0], { ...input, ownerId: owners[1] }));
    const replay = await asOwner(0, tx => saveTrip(tx, owners[0], input));
    assert.equal(first.id, replay.id); assert.equal(replay.replayed, true);
    assert.equal(await db.trip.count({ where: { ownerId: owners[0] } }), 1);
    const saved = await asOwner(0, tx => readSavedTrip(tx, first.id)); assert(saved);
    assert.equal(saved.trip.ownerId, owners[0]); assert.equal(saved.trip.knownTotalMinor, BigInt(1500000)); assert.equal(saved.trip.unknownCount, 1);
    assert.equal(saved.trip.days.length, 3); assert.equal(saved.trip.days.flatMap(d => d.items).length, 4);
    assert.equal(saved.trip.days.flatMap(d => d.items).find(i => i.category === "guides")?.estimated, true);
    await assert.rejects(asOwner(0, tx => saveTrip(tx, owners[0], { ...input, title: "Different details" })), TripReplayMismatch);
    const parallel = { ...input, key: randomUUID(), title: "Concurrent retry test" };
    const twins = await Promise.all([asOwner(0, tx => saveTrip(tx, owners[0], parallel)), asOwner(0, tx => saveTrip(tx, owners[0], parallel))]);
    assert.equal(twins[0].id, twins[1].id); assert.equal(twins.filter(t => !t.replayed).length, 1);
    const aborted = { ...input, key: randomUUID(), title: "Rollback test" };
    await assert.rejects(asOwner(0, async tx => { await saveTrip(tx, owners[0], aborted); throw new Error("Simulated interrupted transaction"); }));
    assert.equal(await db.tripSave.count({ where: { ownerId: owners[0], key: aborted.key } }), 0);
    const recovered = await asOwner(0, tx => saveTrip(tx, owners[0], aborted));
    assert.equal(recovered.replayed, false);
    const edits = await Promise.allSettled(["Newer A", "Newer B"].map(title => asOwner(0, tx => saveTrip(tx, owners[0], { ...input, key: randomUUID(), tripId: first.id, revision: 1, title }))));
    assert.equal(edits.filter(r => r.status === "fulfilled").length, 1);
    assert(edits.some(r => r.status === "rejected" && r.reason instanceof TripConflict));
    assert.equal((await db.trip.findUniqueOrThrow({ where: { id: first.id } })).revision, 2);
    const b = await asOwner(1, tx => saveTrip(tx, owners[1], { ...input, key: randomUUID(), title: "Second owner" }));
    for (const other of [1,2]) await asOwner(other, async tx => {
      assert.equal(await tx.trip.findUnique({ where: { id: first.id } }), null);
      assert.equal(await tx.tripDay.count({ where: { tripId: first.id } }), 0);
      assert.equal(await tx.tripItem.count({ where: { tripId: first.id } }), 0);
      assert.equal(await tx.tripSave.count({ where: { tripId: first.id } }), 0);
    });
    await assert.rejects(asOwner(1, tx => saveTrip(tx, owners[1], { ...input, key: randomUUID(), tripId: first.id, revision: 2 })));
    const otherOwnDay = await db.tripDay.findFirstOrThrow({ where: { tripId: recovered.id } });
    const item = await db.tripItem.findFirstOrThrow({ where: { tripId: first.id } });
    await assert.rejects(asOwner(0, tx => tx.tripItem.create({ data: { ...item, id: undefined, selectionId: randomUUID(), dayId: otherOwnDay.id } })), "An item cannot refer to a day in another trip, even with the same owner.");
    const firstDay = await db.tripDay.findFirstOrThrow({ where: { tripId: first.id } });
    await assert.rejects(asOwner(0, tx => tx.tripDay.create({ data: { tripId: first.id, date: firstDay.date } })));
    await assert.rejects(asOwner(0, tx => tx.trip.update({ where: { id: first.id }, data: { title: "Missing revision increment" } })));
    await assert.rejects(asOwner(1, tx => tx.tripSave.create({ data: { ownerId: owners[1], key: randomUUID(), tripId: first.id, requestHash: "a".repeat(64), revision: 2 } })));
    await assert.rejects(db.$transaction(async tx => { await tx.$executeRaw`SET LOCAL ROLE gochitral_public`; await tx.trip.findMany(); }));
    await db.listing.update({ where: { id: listingIds[0] }, data: { status: "suspended" } });
    const withdrawn = await asOwner(0, tx => readSavedTrip(tx, first.id)); assert(withdrawn);
    const hotelItems = withdrawn.trip.days.flatMap(d => d.items).filter(i => i.category === "hotels");
    assert(hotelItems.every(i => !withdrawn.available.has(i.id) && i.title.includes("Trip verification hotels")));
    assert.equal(withdrawn.trip.knownTotalMinor, BigInt(1500000));
    await assert.rejects(asOwner(0, tx => saveTrip(tx, owners[0], { ...input, key: randomUUID() })), TripValidation);
    await db.authSession.update({ where: { id: sessions[0] }, data: { revokedAt: new Date() } });
    await asOwner(0, async tx => { assert.equal(await tx.trip.count(),0); assert.equal(await tx.tripItem.count(),0); });
    assert.equal((await db.trip.findUniqueOrThrow({ where: { id: b.id } })).ownerId, owners[1]);
    assert.equal(returnPath("/plan"), "/plan"); assert.equal(returnPath(`/my-trips/${first.id}/edit`), `/my-trips/${first.id}/edit`);
    assert.equal(returnPath("//evil.example"), "/account");
    console.log("Saved trips: PKR snapshots, atomic rollback/retry, lost-response replay, concurrent idempotency, revision conflict, owner/admin/public isolation, day uniqueness/composite FK, immutable identity, withdrawn titles/prices and revoked-session denial passed.");
  } finally {
    await db.account.deleteMany({ where: { id: { in: owners } } });
    await db.room.deleteMany({ where: { hotelId: { in: listingIds } } });
    await db.listing.deleteMany({ where: { id: { in: listingIds } } });
    await db.$disconnect();
    console.log("Temporary trip accounts, sessions, trips and catalogue fixtures removed.");
  }
}
verify();
