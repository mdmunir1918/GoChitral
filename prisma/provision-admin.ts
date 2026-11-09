import { config } from "dotenv";
import { Client } from "pg";
import { z } from "zod";

config({ path: [".env.local", ".env"], quiet: true });
const id = z.uuid().parse(process.argv[2]);
if (!process.env.DIRECT_URL) throw new Error("Set DIRECT_URL for the trusted database operator.");
const db = new Client({ connectionString: process.env.DIRECT_URL, connectionTimeoutMillis: 5000 });
async function provision() {
  await db.connect();
  try {
    const result = await db.query(`UPDATE public."Account" SET role = 'administrator' WHERE id = $1
      AND EXISTS (SELECT 1 FROM auth.users WHERE id = $1 AND email_confirmed_at IS NOT NULL)
      AND EXISTS (SELECT 1 FROM auth.mfa_factors WHERE user_id = $1 AND status = 'verified')
      RETURNING id`, [id]);
    if (result.rowCount !== 1) throw new Error("Use a confirmed account with a verified authenticator.");
    console.log("Administrator provisioned. Authenticator verification is required on sign-in.");
  } finally { await db.end(); }
}
provision();
