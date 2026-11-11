import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { config } from "dotenv";
import { Client } from "pg";

config({ path: [".env.local", ".env"], quiet: true });
if (!process.env.DIRECT_URL) throw new Error("Set DIRECT_URL for the development database.");
async function rehearse() {
  const path = "prisma/migrations/202611100012_guide_request_snapshots/migration.sql";
  const sql = await readFile(path, "utf8");
  assert.match(sql, /COMMIT;\s*$/);
  const client = new Client({ connectionString: process.env.DIRECT_URL });
  await client.connect();
  try {
    await client.query(sql.replace(/COMMIT;\s*$/, "ROLLBACK;"));
    console.log("Guide-request migration rehearsal passed and rolled back; no schema changes were retained.");
  } finally { await client.end(); }
}
rehearse();
