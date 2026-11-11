import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { adminMfaRequired } from "../src/lib/auth/security";

config({ path: [".env.local", ".env"], quiet: true });
if (adminMfaRequired() || !process.env.DIRECT_URL) throw new Error("Run this demo seed only in the configured local development app.");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }) });

const demoGuides = [
  { id: "guide-demo-02", slug: "demo-kalasha-culture-walk", title: "DEMO · Kalasha culture walk", location: "Bumburet Valley", destinationId: "dest-001", photoId: "/images/bumburet-valley.webp", price: 5000, languages: ["Khowar", "Urdu", "English"], expertise: ["Cultural walking tours", "Local history"], areasServed: ["Bumburet", "Brun"] },
  { id: "guide-demo-03", slug: "demo-rumbur-valley-hike", title: "DEMO · Rumbur valley hike", location: "Rumbur Valley", destinationId: "dest-001", photoId: "/images/bumburet-valley.webp", price: 6500, languages: ["Khowar", "Urdu"], expertise: ["Day hikes", "Village walks"], areasServed: ["Rumbur", "Ghazandeh"] },
  { id: "guide-demo-04", slug: "demo-birir-village-trail", title: "DEMO · Birir village trail", location: "Birir Valley", destinationId: "dest-001", photoId: "/images/bumburet-valley.webp", price: 6000, languages: ["Khowar", "Urdu", "English"], expertise: ["Village trails", "Landscape photography routes"], areasServed: ["Birir", "Bumburet"] },
  { id: "guide-demo-05", slug: "demo-chitral-town-heritage", title: "DEMO · Chitral town heritage", location: "Chitral town", destinationId: "dest-002", photoId: "/images/chitral-and-tirich-mir.webp", price: 4500, languages: ["Khowar", "Urdu", "English"], expertise: ["Town heritage", "Museum visits"], areasServed: ["Chitral town", "Drosh"] },
  { id: "guide-demo-06", slug: "demo-garam-chashma-day-trip", title: "DEMO · Garam Chashma day trip", location: "Garam Chashma", destinationId: "dest-002", photoId: "/images/chitral-and-tirich-mir.webp", price: 8000, languages: ["Khowar", "Urdu"], expertise: ["Day trips", "Mountain communities"], areasServed: ["Garam Chashma", "Chitral town"] },
  { id: "guide-demo-07", slug: "demo-mastuj-local-routes", title: "DEMO · Mastuj local routes", location: "Mastuj", destinationId: "dest-002", photoId: "/images/chitral-and-tirich-mir.webp", price: 7500, languages: ["Khowar", "Urdu", "English"], expertise: ["Local road stops", "Village walks"], areasServed: ["Mastuj", "Chuinj"] },
  { id: "guide-demo-08", slug: "demo-bumburet-family-walk", title: "DEMO · Bumburet family walk", location: "Bumburet Valley", destinationId: "dest-001", photoId: "/images/bumburet-valley.webp", price: 5500, languages: ["Khowar", "Urdu"], expertise: ["Easy walks", "Family-friendly routes"], areasServed: ["Bumburet", "Brun"] },
  { id: "guide-demo-09", slug: "demo-chitral-food-and-market", title: "DEMO · Chitral market walk", location: "Chitral town", destinationId: "dest-002", photoId: "/images/chitral-and-tirich-mir.webp", price: 4000, languages: ["Khowar", "Urdu", "English"], expertise: ["Market walks", "Local food"], areasServed: ["Chitral town"] },
  { id: "guide-demo-10", slug: "demo-kalasha-museum-visit", title: "DEMO · Kalasha museum visit", location: "Bumburet Valley", destinationId: "dest-001", photoId: "/images/kalasha-dur.webp", price: 5000, languages: ["Khowar", "Urdu", "English"], expertise: ["Museum visits", "Cultural history"], areasServed: ["Brun", "Bumburet"] },
] as const;

async function seed() {
  const sample = await db.listing.findFirst({ where: { id: "guide-001", category: "guides", status: "published" }, select: { id: true } });
  if (!sample) throw new Error("Publish the existing fictional guide fixture first.");
  const mediaIds = [...new Set(demoGuides.map((guide) => guide.photoId))];
  const media = await db.media.findMany({ where: { id: { in: mediaIds } }, select: { id: true } });
  if (media.length !== mediaIds.length) throw new Error("Seed the standard development catalogue photos first.");

  await db.$transaction(async (tx) => {
    for (const [index, guide] of demoGuides.entries()) {
      const summary = "DEMO DATA — fictional profile for testing only. This is not a real guide or service.";
      const listing = {
        category: "guides" as const, slug: guide.slug, title: guide.title, location: guide.location,
        summary, description: `Fictional testing profile for ${guide.expertise.join(" and ")} around ${guide.location}. It has no real operator or booking availability.`,
        visitorNote: "TEST PROFILE ONLY — not a real operator. Do not send payments or rely on this profile for travel plans.",
        reviewed: new Date("2026-11-10"), status: "published" as const, displayOrder: 50 + index,
        destinationId: guide.destinationId, destinationCategory: "destinations" as const,
        photoId: guide.photoId, servicePriceMinor: guide.price,
      };
      await tx.listing.upsert({ where: { id: guide.id }, create: { id: guide.id, ...listing }, update: listing });
      const profile = {
        languages: [...guide.languages], expertise: [...guide.expertise], areasServed: [...guide.areasServed],
        credentialSummary: "DEMO ONLY — fictional test data. No person or credential has been verified.", pricingUnit: "per_group_day" as const,
      };
      await tx.guideProfile.upsert({ where: { guideId: guide.id }, create: { guideId: guide.id, ...profile }, update: profile });
    }
  });
  const total = await db.guideProfile.count({ where: { guide: { category: "guides", status: "published" } } });
  console.log(`Seeded ${demoGuides.length} fictional guide profiles. There are ${total} published profiles including the original sample; no accounts or requests were created.`);
}
seed().finally(() => db.$disconnect());
