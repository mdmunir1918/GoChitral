import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import sharp from "sharp";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { saveHotel, reviewHotel, HotelConflict } from "../src/features/hotels/save";
import { savePublication } from "../src/features/publishing/save";
import { processHotelImage, maxUploadBytes } from "../src/features/hotels/images";
config({ path: [".env.local", ".env"], quiet: true });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }) });
class Success extends Error {}
async function verify() {
  const source = await sharp({ create: { width: 1800, height: 1200, channels: 3, background: "#392f48" } }).jpeg().withMetadata().toBuffer();
  const processed = await processHotelImage(source);
  const metadata = await sharp(processed.data).metadata();
  assert.equal(metadata.format, "webp"); assert(!metadata.exif); assert(processed.width <= 1600);
  await assert.rejects(processHotelImage(Buffer.from("not an image renamed.jpg")));
  await assert.rejects(processHotelImage(Buffer.alloc(maxUploadBytes + 1)));
  await assert.rejects(processHotelImage(await sharp({ create: { width: 9000, height: 2, channels: 3, background: "white" } }).png().toBuffer()));
  try {
    await prisma.$transaction(async (tx) => {
      const people = [randomUUID(), randomUUID(), randomUUID()]; const sessions = people.map(() => randomUUID());
      const hotelA = randomUUID(), hotelB = randomUUID(), roomA = randomUUID(), roomB = randomUUID(), photoA = randomUUID();
      for (const [index, id] of people.entries()) {
        await tx.account.create({ data: { id, email: `hotel-check-${id}@example.invalid`, role: index === 2 ? "administrator" : "manager" } });
        await tx.authSession.create({ data: { id: sessions[index], accountId: id, expiresAt: new Date(Date.now() + 3600000), mfaVerifiedAt: index === 2 ? new Date() : null } });
      }
      const destination = await tx.listing.findFirstOrThrow({ where: { category: "destinations", status: "published" } });
      const content = (room: string) => ({ title: "Verification Hotel", destinationId: destination.id, contactUrl: "https://example.com/hotel", summary: "A hotel for verification", description: "Development test description", visitorNote: "Ask before travelling", amenities: ["Wi-Fi"], rooms: [{ id: room, title: "Double room", capacity: 2, nightlyRate: "2000.50", availabilityNote: "Call to confirm", archived: false }] });
      async function role(index: number, aal = index === 2 ? "aal2" : "aal1") {
        await tx.$executeRaw`SET LOCAL ROLE authenticated`;
        await tx.$queryRaw`SELECT set_config('request.jwt.claims',${JSON.stringify({ sub: people[index], session_id: sessions[index], role: "authenticated", aal })},true)`;
      }
      async function rejection(action: () => Promise<unknown>) {
        await tx.$executeRaw`SAVEPOINT denied`;
        try { await assert.rejects(action()); } finally { await tx.$executeRaw`ROLLBACK TO SAVEPOINT denied`; }
      }
      await role(0);
      let a = await saveHotel(tx, { id: hotelA, ownerId: people[0], version: 0, submit: false, content: content(roomA) });
      await tx.hotelPhoto.create({ data: { id: photoA, hotelId: hotelA, key: `${people[0]}/${hotelA}/${photoA}.webp`, width: 100, height: 100, bytes: 100 } });
      await rejection(() => tx.hotelDraft.update({ where: { id: hotelA }, data: { status: "approved", version: { increment: 1 } } }));
      await rejection(() => tx.hotelDraft.update({ where: { id: hotelA }, data: { ownerId: people[1], version: { increment: 1 } } }));
      await rejection(() => tx.hotelPhoto.update({ where: { id: photoA }, data: { approved: true } }));
      await rejection(() => tx.hotelPhoto.update({ where: { id: photoA }, data: { key: "overwrite.webp" } }));
      const extraPhotos = Array.from({ length: 7 }, () => randomUUID());
      for (const id of extraPhotos) await tx.hotelPhoto.create({ data: { id, hotelId: hotelA, key: `${people[0]}/${hotelA}/${id}.webp`, width: 100, height: 100, bytes: 100 } });
      const ninth = randomUUID();
      await rejection(() => tx.hotelPhoto.create({ data: { id: ninth, hotelId: hotelA, key: `${people[0]}/${hotelA}/${ninth}.webp`, width: 100, height: 100, bytes: 100 } }));
      await tx.hotelPhoto.deleteMany({ where: { id: { in: extraPhotos } } });
      await role(1);
      await saveHotel(tx, { id: hotelB, ownerId: people[1], version: 0, submit: false, content: content(roomB) });
      assert.equal((await tx.hotelRoomDraft.updateMany({ where: { id: roomA }, data: { nightlyMinor: 1 } })).count, 0);
      assert.equal((await tx.hotelPhoto.updateMany({ where: { id: photoA }, data: { inDraft: false } })).count, 0);
      assert.equal(await tx.hotelPhoto.findUnique({ where: { id: photoA } }), null);
      await rejection(() => tx.hotelPhoto.create({ data: { id: randomUUID(), hotelId: hotelB, key: `${people[0]}/${hotelA}/${photoA}.webp`, width: 100, height: 100, bytes: 100 } }));
      await role(0);
      assert.equal((await tx.hotelRoomDraft.findUniqueOrThrow({ where: { id: roomA } })).nightlyMinor, 200050);
      await rejection(() => saveHotel(tx, { id: hotelA, ownerId: people[0], version: a.version, submit: false, content: content(roomB) }));
      a = await saveHotel(tx, { id: hotelA, ownerId: people[0], version: a.version, submit: true, content: content(roomA) });
      await rejection(() => tx.hotelRoomDraft.update({ where: { id: roomA }, data: { nightlyMinor: 1 } }));
      await tx.$executeRaw`SET LOCAL ROLE gochitral_public`;
      assert.equal(await tx.hotelPhoto.count({ where: { hotelId: hotelA } }), 0);
      assert.equal(await tx.listing.findUnique({ where: { id: hotelA } }), null);
      await role(2, "aal1"); assert.equal(await tx.hotelDraft.findUnique({ where: { id: hotelA } }), null);
      await role(2);
      const url = await reviewHotel(tx, { id: hotelA, version: a.version, approve: true, reason: "Verified hotel" }); assert(url?.startsWith("/hotels/"));
      await tx.$executeRaw`SET LOCAL ROLE gochitral_public`;
      assert.equal((await tx.room.findUniqueOrThrow({ where: { id: roomA } })).nightlyMinor, 200050);
      assert.equal(await tx.hotelPhoto.count({ where: { hotelId: hotelA } }), 1);
      assert.deepEqual((await tx.hotelDetails.findUniqueOrThrow({ where: { hotelId: hotelA } })).amenities, ["Wi-Fi"]);
      await role(0); a = await tx.hotelDraft.findUniqueOrThrow({ where: { id: hotelA } });
      const edited = content(roomA); edited.rooms[0].nightlyRate = "4000";
      const oldVersion = a.version;
      a = await saveHotel(tx, { id: hotelA, ownerId: people[0], version: a.version, submit: false, content: edited });
      await assert.rejects(saveHotel(tx, { id: hotelA, ownerId: people[0], version: oldVersion, submit: false, content: edited }), HotelConflict);
      await tx.$executeRaw`SET LOCAL ROLE gochitral_public`;
      assert.equal((await tx.room.findUniqueOrThrow({ where: { id: roomA } })).nightlyMinor, 200050, "Draft rates must not replace approved prices.");
      await role(0); edited.rooms[0].archived = true; edited.rooms.push({ ...content(randomUUID()).rooms[0], title: "Suite" });
      a = await saveHotel(tx, { id: hotelA, ownerId: people[0], version: a.version, submit: true, content: edited });
      await role(2); await reviewHotel(tx, { id: hotelA, version: a.version, approve: true, reason: "Archive old room" });
      assert.equal((await tx.room.findUniqueOrThrow({ where: { id: roomA } })).nightlyMinor, 200050);
      assert.equal((await tx.room.findUniqueOrThrow({ where: { id: roomA } })).status, "suspended");
      const listing = await tx.listing.findUniqueOrThrow({ where: { id: hotelA } });
      await savePublication(tx, { listingId: hotelA, version: listing.version, intent: "suspend", content: undefined, reason: "Verification suspension", evidence: "" });
      await tx.$executeRaw`SET LOCAL ROLE gochitral_public`;
      assert.equal(await tx.listing.findUnique({ where: { id: hotelA } }), null);
      assert.equal(await tx.hotelPhoto.count({ where: { hotelId: hotelA } }), 0);
      assert.equal(await tx.room.count({ where: { hotelId: hotelA } }), 0);
      throw new Success();
    }, { timeout: 180000, maxWait: 15000 });
  } catch (error) { if (!(error instanceof Success)) throw error; }
  finally { await prisma.$disconnect(); }
  console.log("Two-manager room/photo isolation, owner and approval guards, pending freeze, stale saves, public approval, draft rate isolation, archive retention, suspension and image validation passed. Fixtures rolled back.");
}
verify();
