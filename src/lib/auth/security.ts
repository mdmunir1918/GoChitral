import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import * as OTPAuth from "otpauth";

function key() {
  if (!process.env.AUTH_SECRET) throw new Error("Authentication is not configured.");
  return createHash("sha256").update("GoChitral MFA encryption\0").update(process.env.AUTH_SECRET).digest();
}

export function encryptMfa(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptMfa(encrypted: string) {
  const [iv, tag, value] = encrypted.split(".").map((part) => Buffer.from(part, "base64url"));
  const cipher = createDecipheriv("aes-256-gcm", key(), iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(value), cipher.final()]).toString("utf8");
}

export function totpStep(secret: string, code: string) {
  const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), algorithm: "SHA1", digits: 6, period: 30 });
  const delta = totp.validate({ token: code, window: 1 });
  return delta === null ? null : BigInt(Math.floor(Date.now() / 30000) + delta);
}

export function newMfaSecret() {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function emailVerificationRequired() {
  return process.env.AUTH_REQUIRE_EMAIL_VERIFICATION === "true";
}

export function adminMfaRequired() {
  // Allow password-only admin testing only on an explicitly configured local app.
  if (process.env.AUTH_REQUIRE_ADMIN_MFA !== "false") return true;
  try { return !["127.0.0.1", "localhost", "[::1]"].includes(new URL(process.env.APP_ORIGIN ?? "").hostname); }
  catch { return true; }
}
