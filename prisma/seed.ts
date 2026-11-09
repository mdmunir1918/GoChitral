import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { fixtures } from "../src/data/catalogue-fixtures";

config({ path: [".env.local", ".env"], quiet: true });
if (!process.env.DIRECT_URL) throw new Error("Set DIRECT_URL for the development database.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }) });

async function seed() {
  await prisma.$transaction(async (tx) => {
    for (const [displayOrder, item] of fixtures.entries()) {
      const { photo, source, destinationId, ...fields } = item;
      const photoId = photo.src;
      await tx.media.upsert({ where: { id: photoId }, create: { id: photoId, ...photo }, update: photo });
      const data = {
        ...fields, reviewed: new Date(item.reviewed), displayOrder, photoId,
        sourceTitle: source?.title ?? null, sourceUrl: source?.url ?? null,
        destinationId: destinationId ?? null,
        destinationCategory: destinationId ? "destinations" as const : null,
      };
      await tx.listing.upsert({ where: { id: item.id }, create: data, update: data });
    }
  });
  console.log("Development catalogue seeded.");
}

seed().finally(() => prisma.$disconnect());
