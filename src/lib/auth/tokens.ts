import "server-only";
import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { authDatabase } from "./store";
import { tokenHash } from "./security";
import { sendAccountLink } from "./mail";

export async function issueAccountLink(accountId: string, email: string, kind: "email" | "recovery") {
  const token = randomBytes(32).toString("hex");
  await authDatabase(async (tx) => {
    await tx.authToken.deleteMany({ where: { accountId, kind } });
    await tx.authToken.create({ data: { accountId, kind, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 3600000) } });
  });
  const url = new URL("/auth/confirm", process.env.APP_ORIGIN);
  url.searchParams.set("type", kind);
  url.searchParams.set("token_hash", token);
  await sendAccountLink(email, kind === "email" ? "Confirm your GoChitral account" : "Reset your GoChitral password", url.toString());
}

export async function recoveryToken(token: string) {
  return authDatabase((tx) => tx.authToken.findFirst({
    where: { tokenHash: tokenHash(token), kind: "recovery", expiresAt: { gt: new Date() } },
    select: { id: true, accountId: true },
  }));
}

export async function confirmEmail(token: string) {
  return authDatabase(async (tx) => {
    const row = await tx.authToken.findFirst({ where: { tokenHash: tokenHash(token), kind: "email", expiresAt: { gt: new Date() } } });
    if (!row) return false;
    const consumed = await tx.authToken.deleteMany({ where: { id: row.id, expiresAt: { gt: new Date() } } });
    if (consumed.count !== 1) return false;
    await tx.account.update({ where: { id: row.accountId }, data: { emailVerified: new Date() } });
    return true;
  });
}

export async function changeRecoveredPassword(token: string, password: string) {
  const passwordHash = await hash(password, 12);
  return authDatabase(async (tx) => {
    const row = await tx.authToken.findFirst({ where: { tokenHash: tokenHash(token), kind: "recovery", expiresAt: { gt: new Date() } } });
    if (!row) return false;
    const consumed = await tx.authToken.deleteMany({ where: { id: row.id, expiresAt: { gt: new Date() } } });
    if (consumed.count !== 1) return false;
    await tx.authCredential.upsert({ where: { accountId: row.accountId }, create: { accountId: row.accountId, passwordHash }, update: { passwordHash } });
    await tx.account.update({ where: { id: row.accountId }, data: { emailVerified: new Date() } });
    await tx.authSession.updateMany({ where: { accountId: row.accountId, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.authToken.deleteMany({ where: { accountId: row.accountId } });
    return true;
  });
}
