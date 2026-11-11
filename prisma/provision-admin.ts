import { config } from "dotenv";
import { Client } from "pg";
import { z } from "zod";
import { adminMfaRequired } from "../src/lib/auth/security";

config({ path: [".env.local", ".env"], quiet: true });
const id = z.uuid().parse(process.argv[2]);
if (!process.env.DIRECT_URL) throw new Error("Set DIRECT_URL for the trusted database operator.");
const db = new Client({ connectionString: process.env.DIRECT_URL, connectionTimeoutMillis: 5000 });
async function provision() {
  await db.connect();
  try {
    const result = await db.query(`UPDATE public."Account" SET role = 'administrator' WHERE id = $1
      AND ($2::boolean = false OR "emailVerified" IS NOT NULL)
      AND ($3::boolean = false OR EXISTS (SELECT 1 FROM public."AuthCredential" WHERE "accountId" = $1 AND "mfaEnabled" = true))
      RETURNING id`, [id, process.env.AUTH_REQUIRE_EMAIL_VERIFICATION === "true", adminMfaRequired()]);
    if (result.rowCount !== 1) throw new Error("Use an eligible account. Email confirmation and authenticator requirements follow the configured auth settings.");
    console.log(adminMfaRequired() ? "Administrator provisioned. Authenticator verification is required on sign-in." : "Administrator provisioned for local password-only testing.");
  } finally { await db.end(); }
}
provision();
