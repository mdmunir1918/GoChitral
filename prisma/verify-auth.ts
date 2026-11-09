import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { config } from "dotenv";
import { returnPath } from "../src/lib/auth/return-path";

config({ path: [".env.local", ".env"], quiet: true });
if (!process.env.DIRECT_URL) throw new Error("Set DIRECT_URL for the isolated development database.");
const db = new Client({ connectionString: process.env.DIRECT_URL, connectionTimeoutMillis: 5000 });

async function denied(sql: string) {
  await db.query("SAVEPOINT expected_denial");
  try {
    await assert.rejects(db.query(sql), (error: unknown) =>
      error instanceof Error && "code" in error && error.code === "42501");
  } finally {
    await db.query("ROLLBACK TO SAVEPOINT expected_denial");
  }
}

async function verify() {
  assert.equal(returnPath("//external.example"), "/account");
  assert.equal(returnPath("/\\external.example"), "/account");
  assert.equal(returnPath("https://external.example"), "/account");
  assert.equal(returnPath("/explore?q=Bumburet"), "/explore?q=Bumburet");
  await db.connect();
  await db.query("BEGIN");
  try {
    const people = [
      { id: randomUUID(), session: randomUUID(), metadata: "administrator", role: "tourist" },
      { id: randomUUID(), session: randomUUID(), metadata: "tourist", role: "tourist" },
      { id: randomUUID(), session: randomUUID(), metadata: "manager", role: "manager" },
      { id: randomUUID(), session: randomUUID(), metadata: "manager", role: "manager" },
    ];
    for (const person of people) {
      await db.query("INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3)",
        [person.id, `fixture-${person.id}@example.invalid`, JSON.stringify({ account_type: person.metadata })]);
      await db.query("INSERT INTO auth.sessions (id, user_id) VALUES ($1, $2)", [person.session, person.id]);
    }
    const columns = await db.query(`SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Listing' ORDER BY ordinal_position`);
    const names = columns.rows.map((row) => `"${row.column_name}"`).join(", ");
    for (const [offset, person] of people.slice(2).entries()) {
      const id = `verify-manager-${offset}`;
      const values = columns.rows.map((row) => {
        if (row.column_name === "id" || row.column_name === "slug") return "$1";
        if (row.column_name === "status") return "'draft'";
        return `"${row.column_name}"`;
      }).join(", ");
      await db.query(`INSERT INTO "Listing" (${names}) SELECT ${values} FROM "Listing" WHERE id = 'hotel-001'`, [id]);
      await db.query('INSERT INTO "HotelOwnership" ("hotelId", "ownerId") VALUES ($1, $2)', [id, person.id]);
    }
    for (const [index, person] of people.entries()) {
      await db.query("SET LOCAL ROLE authenticated");
      await db.query("SELECT set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: person.id, role: "authenticated", session_id: person.session, aal: "aal1" }),
      ]);
      const profiles = await db.query('SELECT id, role FROM "Account"');
      assert.deepEqual(profiles.rows, [{ id: person.id, role: person.role }]);
      const hotels = await db.query('SELECT id FROM "Listing" WHERE id LIKE \'verify-manager-%\' ORDER BY id');
      assert.deepEqual(hotels.rows.map((row) => row.id), index >= 2 ? [`verify-manager-${index - 2}`] : []);
      await denied('UPDATE "Account" SET role = \'administrator\'');
      await denied('UPDATE "Listing" SET status = \'published\'');
      await db.query("RESET ROLE");
    }
    const person = people[2];
    await db.query("DELETE FROM auth.sessions WHERE id = $1", [person.session]);
    await db.query("SET LOCAL ROLE authenticated");
    await db.query("SELECT set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: person.id, role: "authenticated", session_id: person.session, aal: "aal1" }),
    ]);
    assert.equal((await db.query('SELECT id FROM "Account"')).rowCount, 0);
    assert.equal((await db.query('SELECT id FROM "Listing" WHERE id = \'verify-manager-0\'')).rowCount, 0);
    await db.query("RESET ROLE");
    const bucket = "f".repeat(64);
    await db.query('DELETE FROM "AuthRateLimit" WHERE key = $1', [bucket]);
    for (let count = 1; count <= 9; count++) {
      const result = await db.query("SELECT public.gochitral_auth_attempt($1) AS allowed", [bucket]);
      assert.equal(result.rows[0].allowed, count <= 8);
    }
    console.log("Two tourists and two managers passed profile isolation, draft ownership, role escalation denial, session revocation, return paths and shared rate limits.");
  } finally {
    await db.query("ROLLBACK");
    await db.end();
  }
}

verify();
