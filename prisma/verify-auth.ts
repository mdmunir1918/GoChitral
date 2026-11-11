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
  assert.equal(returnPath("/guides/sample-bumburet-guide"), "/guides/sample-bumburet-guide");
  assert.equal(returnPath("/my-trips/requests/GC-A1B2C3D4"), "/my-trips/requests/GC-A1B2C3D4");
  await db.connect();
  await db.query("BEGIN");
  try {
    const people = [
      { id: randomUUID(), session: randomUUID(), role: "tourist" },
      { id: randomUUID(), session: randomUUID(), role: "tourist" },
      { id: randomUUID(), session: randomUUID(), role: "manager" },
      { id: randomUUID(), session: randomUUID(), role: "manager" },
    ];
    for (const person of people) {
      await db.query('INSERT INTO public."Account" (id, email, role) VALUES ($1, $2, $3::"AccountRole")',
        [person.id, `fixture-${person.id}@example.invalid`, person.role]);
      await db.query(`INSERT INTO public."AuthSession" (id, "accountId", "expiresAt") VALUES ($1, $2, now() + interval '1 day')`, [person.session, person.id]);
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
      await denied('SELECT * FROM "AuthCredential"');
      await denied('SELECT * FROM "AuthToken"');
      await denied('SELECT * FROM "AuthSession"');
      if (index === 0) await denied("SELECT public.gochitral_auth_success(repeat('a', 64))");
      assert.equal((await db.query('UPDATE "Listing" SET status = \'published\'')).rowCount, 0);
      await db.query("RESET ROLE");
    }
    const person = people[2];
    await db.query('DELETE FROM public."AuthSession" WHERE id = $1', [person.session]);
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
