import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import sharp from "sharp";
import { saveHotel, reviewHotel } from "../src/features/hotels/save";
import { putPhoto, deletePhoto } from "../src/lib/storage/r2";
import { adminMfaRequired } from "../src/lib/auth/security";

config({ path: [".env.local", ".env"], quiet: true });
if (adminMfaRequired() || !process.env.DIRECT_URL) throw new Error("Run this seed only in the configured local development app with password-only admin testing enabled.");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }) });
const hotels = [
  { name: "Riverstone Lodge", destination: "dest-002", rate: 4500, summary: "A quiet riverside-style stay with a shared garden and breakfast area.", amenities: ["Breakfast", "Parking", "Garden", "Wi-Fi"] },
  { name: "Mountain Lantern Hotel", destination: "dest-002", rate: 6200, summary: "A town hotel with spacious rooms, a reading lounge and mountain-view terraces.", amenities: ["Wi-Fi", "Heating", "Terrace", "Restaurant"] },
  { name: "Cedar Courtyard Inn", destination: "dest-002", rate: 3800, summary: "A small courtyard inn designed for travellers who prefer simple, comfortable rooms.", amenities: ["Courtyard", "Parking", "Hot water", "Tea service"] },
  { name: "Chitral Garden Suites", destination: "dest-002", rate: 8500, summary: "A family stay with larger suites, a garden and space for a longer visit.", amenities: ["Family rooms", "Garden", "Wi-Fi", "Laundry"] },
  { name: "Old Town Guesthouse", destination: "dest-002", rate: 3000, summary: "A budget guesthouse with a shared lounge and easy access to town facilities.", amenities: ["Shared lounge", "Hot water", "Luggage storage", "Breakfast"] },
  { name: "Valley Orchard Retreat", destination: "dest-001", rate: 5500, summary: "An orchard-style retreat with outdoor seating and comfortable double rooms.", amenities: ["Outdoor seating", "Breakfast", "Parking", "Garden"] },
  { name: "Juniper Trail Lodge", destination: "dest-001", rate: 4200, summary: "A relaxed base for valley walks with a communal dining space and warm rooms.", amenities: ["Dining room", "Heating", "Hot water", "Parking"] },
  { name: "Bumburet Meadow Stay", destination: "dest-001", rate: 6800, summary: "A small family property with roomy accommodation and a meadow-style garden.", amenities: ["Family rooms", "Garden", "Breakfast", "Backup power"] },
  { name: "Hillside Hearth Inn", destination: "dest-001", rate: 4900, summary: "A hillside-style inn with a shared terrace, tea service and welcoming common areas.", amenities: ["Terrace", "Tea service", "Heating", "Hot water"] },
  { name: "Willow Creek Cabins", destination: "dest-001", rate: 7500, summary: "Cabin-style rooms for couples and families with private seating areas.", amenities: ["Private seating", "Parking", "Breakfast", "Backup power"] },
];
function stableId(label: string) {
  const hex = createHash("sha256").update(`gochitral-demo-hotels-v1:${label}`).digest("hex");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}
async function identity(tx: Prisma.TransactionClient, accountId: string, sessionId: string) {
  await tx.$executeRaw`SET LOCAL ROLE authenticated`;
  await tx.$queryRaw`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: accountId, session_id: sessionId, role: "authenticated", aal: "aal1", admin_mfa_required: false })}, true)`;
}
async function seed() {
  const sessions: string[] = [];
  try {
    const manager = await db.account.findUniqueOrThrow({ where: { email: "manager@gochitral.test" } });
    const admin = await db.account.findUniqueOrThrow({ where: { email: "admin@gochitral.test" } });
    assert.equal(manager.role, "manager"); assert.equal(admin.role, "administrator");
    for (const account of [manager, admin]) {
      const session = await db.authSession.create({ data: { accountId: account.id, expiresAt: new Date(Date.now() + 3600000) } });
      sessions.push(session.id);
    }
    let created = 0;
    for (const [index, hotel] of hotels.entries()) {
      const id = stableId(hotel.name);
      // Re-running the seed never overwrites a hotel the user has edited.
      if (await db.hotelDraft.findUnique({ where: { id } })) { console.log(`Already present: Demo - ${hotel.name}`); continue; }
      const photoId = stableId(`${hotel.name}:photo`);
      const key = `${manager.id}/${id}/${photoId}.webp`;
      // Original, clearly labelled demo illustrations, not photos of real hotels.
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#F5F2F6"/><path d="M0 570 270 180 470 450 720 120 1200 570V800H0" fill="#392F48"/><path d="m610 265 110-145 120 165-119-50z" fill="#F5F2F6"/><rect x="360" y="390" width="480" height="260" rx="12" fill="#9A4A2F"/><path d="m310 410 290-150 290 150" fill="#9A4A2F"/><g fill="#F5F2F6"><rect x="410" y="440" width="80" height="75"/><rect x="710" y="440" width="80" height="75"/><rect x="555" y="495" width="90" height="155"/></g><rect y="665" width="1200" height="135" fill="#F5F2F6"/><text x="60" y="720" font-family="sans-serif" font-size="36" fill="#392F48">${hotel.name}</text><text x="60" y="765" font-family="sans-serif" font-size="24" fill="#9A4A2F">DEMO ILLUSTRATION - NOT A REAL PROPERTY</text></svg>`;
      const image = await sharp(Buffer.from(svg)).webp({ quality: 82 }).toBuffer();
      await putPhoto(key, image);
      try {
        await db.$transaction(async (tx) => {
          await identity(tx, manager.id, sessions[0]);
          const content = {
            title: `Demo - ${hotel.name}`, destinationId: hotel.destination,
            contactUrl: `https://example.com/demo-hotels/${index + 1}`,
            summary: `Demo hotel. ${hotel.summary}`,
            description: `${hotel.summary} This fictional hotel is provided to test GoChitral. Standard rooms have a double bed and private bathroom. Family rooms have a double bed and two single beds. Breakfast is listed as a sample amenity where included. All facilities, rates and availability are dummy data, not verified travel information.`,
            visitorNote: "Fictional property for testing only. Not bookable. Sample check-in: 14:00; check-out: 11:00. Example.com is a placeholder, not a hotel contact. The cover is a demo illustration.",
            amenities: hotel.amenities,
            rooms: [
              { id: stableId(`${hotel.name}:standard`), title: "Standard double", capacity: 2, nightlyRate: hotel.rate.toFixed(2), availabilityNote: "Demo rate per room per night; not live availability.", archived: false },
              { id: stableId(`${hotel.name}:family`), title: "Family room", capacity: 4, nightlyRate: (hotel.rate + 2500).toFixed(2), availabilityNote: "Demo rate for up to four guests; not bookable.", archived: false },
            ],
          };
          const draft = await saveHotel(tx, { id, ownerId: manager.id, version: 0, submit: false, content });
          await tx.hotelPhoto.create({ data: { id: photoId, hotelId: id, key, width: 1200, height: 800, bytes: image.length } });
          const pending = await saveHotel(tx, { id, ownerId: manager.id, version: draft.version, submit: true, content });
          await identity(tx, admin.id, sessions[1]);
          await reviewHotel(tx, { id, version: pending.version, approve: true, reason: "User-requested dummy hotel data for local testing; all details and the illustration are fictional." });
        }, { timeout: 120000, maxWait: 15000 });
      } catch (error) { await deletePhoto(key).catch(() => {}); throw error; }
      created++; console.log(`Created and approved: Demo - ${hotel.name}`);
    }
    const ids = hotels.map(h => stableId(h.name));
    assert.equal(await db.listing.count({ where: { id: { in: ids }, category: "hotels", status: "published" } }), 10);
    assert.equal(await db.room.count({ where: { hotelId: { in: ids }, status: "published" } }), 20);
    assert.equal(await db.hotelPhoto.count({ where: { hotelId: { in: ids }, approved: true } }), 10);
    console.log(`Verified 10 demo hotels, 20 rooms and 10 approved illustrations. Newly created: ${created}. Existing user data preserved.`);
  } finally {
    await db.authSession.deleteMany({ where: { id: { in: sessions } } });
    await db.$disconnect();
  }
}
seed().catch(() => { console.error("Demo seed failed. Existing hotels are preserved; check local database and R2 setup before retrying."); process.exitCode = 1; });
