import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const database = globalThis as unknown as { cataloguePrisma?: PrismaClient };

export function getPrisma() {
  if (!process.env.DATABASE_URL) throw new Error("Catalogue database is not configured.");
  if (!database.cataloguePrisma) {
    database.cataloguePrisma = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
        max: 5,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
      }),
    });
  }
  return database.cataloguePrisma;
}
