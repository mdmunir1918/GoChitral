import assert from "node:assert/strict";
import { config } from "dotenv";
import { Client } from "pg";

config({ path: ".env.local" });
if (!process.env.DIRECT_URL) throw new Error("Set DIRECT_URL for an isolated seeded development database.");
const db = new Client({ connectionString: process.env.DIRECT_URL, connectionTimeoutMillis: 5000 });

async function rejected(sql: string, expectedCode: string, publicRole: boolean) {
  await db.query("BEGIN");
  try {
    if (publicRole) await db.query("SET LOCAL ROLE gochitral_public");
    await assert.rejects(db.query(sql), (error: unknown) =>
      error instanceof Error && "code" in error && error.code === expectedCode);
  } finally {
    await db.query("ROLLBACK");
  }
}

async function verify() {
  await db.connect();
  await db.query("BEGIN");
  try {
    await db.query("SET LOCAL ROLE gochitral_public");
    const rows = await db.query('SELECT id, status FROM "Listing" ORDER BY id');
    assert(rows.rows.some((row) => row.id === "dest-001"), "Seeded Bumburet must be readable");
    assert(rows.rows.every((row) => row.status === "published"));
    assert(!rows.rows.some((row) => row.id === "hotel-002" || row.id === "guide-002"));
  } finally {
    await db.query("ROLLBACK");
  }
  await rejected('UPDATE "Listing" SET title = title WHERE id = \'dest-001\'', "42501", true);
  await rejected('SELECT * FROM "HotelOwnership"', "42501", true);
  await rejected('SELECT * FROM "GuideVerification"', "42501", true);
  await rejected(`INSERT INTO "Room" (id, "hotelId", "hotelCategory", title, capacity, "nightlyMinor", currency, status)
    VALUES ('verify-room', 'hotel-001', 'hotels', 'Check', 0, 0, 'PKR', 'draft')`, "23514", false);
  await rejected(`INSERT INTO "Room" (id, "hotelId", "hotelCategory", title, capacity, "nightlyMinor", currency, status)
    VALUES ('verify-room', 'hotel-001', 'hotels', 'Check', 2, -1, 'PKR', 'draft')`, "23514", false);
  await rejected(`INSERT INTO "Room" (id, "hotelId", "hotelCategory", title, capacity, "nightlyMinor", currency, status)
    VALUES ('verify-room', 'hotel-001', 'hotels', 'Check', 2, 0, 'USD', 'draft')`, "23514", false);
  await db.query("BEGIN");
  try {
    await db.query('UPDATE "Listing" SET status = \'suspended\' WHERE id = \'dest-001\'');
    await db.query("SET LOCAL ROLE gochitral_public");
    const rows = await db.query('SELECT id FROM "Listing" WHERE id IN (\'dest-001\', \'act-001\', \'guide-001\')');
    assert.equal(rows.rowCount, 0, "A suspended destination hides its children");
  } finally {
    await db.query("ROLLBACK");
  }
  console.log("Published reads, hidden records, parent suspension, write denial, private reads and room constraints passed.");
}

verify().finally(() => db.end());
