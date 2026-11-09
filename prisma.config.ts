import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: ".env.local" });
if (!process.env.DIRECT_URL && process.argv.some((argument) => argument === "migrate" || argument === "db")) {
  throw new Error("Set DIRECT_URL in .env.local before running database commands.");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: process.env.DIRECT_URL ? { url: process.env.DIRECT_URL } : undefined,
});
