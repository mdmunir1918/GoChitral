import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { config } from "dotenv";
import { attemptAllowed, attemptKey, checkCredentials, newPasswordSchema, registerAccount } from "../src/lib/auth/credentials";
import { changeRecoveredPassword, confirmEmail, issueAccountLink, recoveryToken } from "../src/lib/auth/tokens";
import { adminMfaRequired, decryptMfa, encryptMfa, newMfaSecret, tokenHash } from "../src/lib/auth/security";
import { getPrisma } from "../src/lib/prisma";

config({ path: [".env.local", ".env"], quiet: true });

async function verify() {
  const origin = process.env.APP_ORIGIN;
  const required = process.env.AUTH_REQUIRE_ADMIN_MFA;
  try {
    process.env.AUTH_REQUIRE_ADMIN_MFA = "false";
    for (const host of ["127.0.0.1", "localhost", "[::1]"]) {
      process.env.APP_ORIGIN = `http://${host}:3000`;
      assert.equal(adminMfaRequired(), false);
    }
    for (const value of ["https://gochitral.example", "invalid"]) {
      process.env.APP_ORIGIN = value;
      assert.equal(adminMfaRequired(), true);
    }
    process.env.APP_ORIGIN = "http://127.0.0.1:3000";
    process.env.AUTH_REQUIRE_ADMIN_MFA = "true";
    assert.equal(adminMfaRequired(), true);
    delete process.env.AUTH_REQUIRE_ADMIN_MFA;
    assert.equal(adminMfaRequired(), true);
  } finally {
    if (origin === undefined) delete process.env.APP_ORIGIN; else process.env.APP_ORIGIN = origin;
    if (required === undefined) delete process.env.AUTH_REQUIRE_ADMIN_MFA; else process.env.AUTH_REQUIRE_ADMIN_MFA = required;
  }
  const db = getPrisma();
  const emails = [0, 1].map(() => `auth-review-${randomUUID()}@example.invalid`);
  const password = "Review12";
  const replacement = "Changed2";
  const outbox = "docs/auth-outbox.local.md";
  const previous = await readFile(outbox, "utf8").catch(() => null);
  const ids: string[] = [];
  process.env.AUTH_EMAIL_MODE = "local";
  process.env.AUTH_REQUIRE_EMAIL_VERIFICATION = "false";
  try {
    assert.equal(newPasswordSchema.safeParse(password).success, true);
    assert.equal(newPasswordSchema.safeParse("Review1").success, false);
    assert.equal(newPasswordSchema.safeParse("abcdefgh").success, false);
    assert.equal(newPasswordSchema.safeParse("12345678").success, false);
    assert.equal(newPasswordSchema.safeParse("x".repeat(73)).success, false);
    assert.equal(newPasswordSchema.safeParse("ä".repeat(40)).success, false);
    const secret = newMfaSecret();
    const encrypted = encryptMfa(secret);
    assert.equal(decryptMfa(encrypted), secret);
    const parts = encrypted.split(".");
    const damaged = Buffer.from(parts[2], "base64url");
    damaged[0] ^= 1;
    parts[2] = damaged.toString("base64url");
    assert.throws(() => decryptMfa(parts.join(".")));

    for (const [index, email] of emails.entries()) {
      const account = await registerAccount(email, password, index ? "manager" : "administrator");
      ids.push(account.id);
      assert.equal((await db.account.findUniqueOrThrow({ where: { id: account.id } })).role, index ? "manager" : "tourist");
      assert(await checkCredentials({ email, password }), "Local registration must allow immediate sign-in.");
    }
    assert.equal(await checkCredentials({ email: emails[0], password: "wrong-password" }), null);
    assert(await checkCredentials({ email: ` ${emails[0].toUpperCase()} `, password }), "Copied email whitespace and case must not prevent sign-in.");
    for (let count = 0; count < 10; count++) {
      assert(await checkCredentials({ email: emails[0], password }), "Successful sign-ins must not accumulate failed attempts.");
    }
    for (const purpose of ["register", "recovery"] as const) {
      for (let count = 1; count <= 9; count++) assert.equal(await attemptAllowed(emails[0], purpose), count <= 8);
    }
    assert(await checkCredentials({ email: emails[0], password }), "Other auth operations must not block sign-in.");
    for (let count = 0; count < 8; count++) assert.equal(await checkCredentials({ email: emails[0], password: "incorrect" }), null);
    await assert.rejects(checkCredentials({ email: emails[0], password }), (error: unknown) =>
      error instanceof Error && "code" in error && error.code === "rate_limit");
    await db.authRateLimit.deleteMany({ where: { key: attemptKey(emails[0], "sign-in") } });
    process.env.AUTH_REQUIRE_EMAIL_VERIFICATION = "true";
    assert.equal(await checkCredentials({ email: emails[0], password }), null);
    await issueAccountLink(ids[0], emails[0], "email");
    const emailLinks = await readFile(outbox, "utf8");
    const confirmation = [...emailLinks.matchAll(/token_hash=([a-f0-9]{64})/g)].at(-1)![1];
    assert(await confirmEmail(confirmation));
    assert.equal(await confirmEmail(confirmation), false, "Confirmation must be single-use.");
    assert(await checkCredentials({ email: emails[0], password }));

    await issueAccountLink(ids[0], emails[0], "recovery");
    const recoveryLinks = await readFile(outbox, "utf8");
    const recovery = [...recoveryLinks.matchAll(/token_hash=([a-f0-9]{64})/g)].at(-1)![1];
    assert(await recoveryToken(recovery));
    assert.equal((await db.authToken.findFirstOrThrow({ where: { accountId: ids[0] } })).tokenHash, tokenHash(recovery));
    assert(await changeRecoveredPassword(recovery, replacement));
    assert.equal(await changeRecoveredPassword(recovery, replacement), false);
    assert.equal(await recoveryToken(recovery), null);
    assert.equal(await db.authSession.count({ where: { accountId: ids[0], revokedAt: null } }), 0);
    assert.equal(await checkCredentials({ email: emails[0], password }), null);
    assert(await checkCredentials({ email: emails[0], password: replacement }));

    await issueAccountLink(ids[0], emails[0], "recovery");
    const expiredLinks = await readFile(outbox, "utf8");
    const expired = [...expiredLinks.matchAll(/token_hash=([a-f0-9]{64})/g)].at(-1)![1];
    await db.authToken.updateMany({ where: { accountId: ids[0] }, data: { expiresAt: new Date(0) } });
    assert.equal(await recoveryToken(expired), null);
    assert.equal(await changeRecoveredPassword(expired, password), false);
    console.log("Immediate local registration, role allowlist, password checks, confirmation, recovery expiry/replay, session revocation and MFA encryption passed.");
  } finally {
    await db.account.deleteMany({ where: { id: { in: ids } } });
    await db.authRateLimit.deleteMany({ where: { key: { in: emails.flatMap((email) =>
      ["sign-in", "register", "recovery", "mfa"].map((purpose) => tokenHash(`${purpose}:${email}`))) } } });
    if (previous === null) await unlink(outbox).catch(() => {});
    else await writeFile(outbox, previous, { mode: 0o600 });
    await db.$disconnect();
  }
}

verify();
