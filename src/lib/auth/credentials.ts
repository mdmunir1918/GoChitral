import "server-only";
import { compare, hash } from "bcryptjs";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { authDatabase } from "./store";
import { emailVerificationRequired, tokenHash } from "./security";

export const emailSchema = z.string().trim().pipe(z.email().max(254)).transform((email) => email.toLowerCase());

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

// bcrypt only hashes the first 72 bytes. Reject truncation for new passwords.
export const newPasswordSchema = z.string().min(8).max(72)
  .regex(/[A-Za-z]/).regex(/[0-9]/)
  .refine((password) => Buffer.byteLength(password, "utf8") <= 72);

export type AttemptPurpose = "sign-in" | "register" | "recovery" | "mfa" | "upload";

export function attemptKey(identity: string, purpose: AttemptPurpose) {
  return tokenHash(`${purpose}:${identity.trim().toLowerCase()}`);
}

async function recordAttempt(tx: Prisma.TransactionClient, identity: string, purpose: AttemptPurpose) {
  const rows = await tx.$queryRaw<{ allowed: boolean }[]>`SELECT public.gochitral_auth_attempt(${attemptKey(identity, purpose)}) AS allowed`;
  return rows[0]?.allowed ?? false;
}

export async function attemptAllowed(identity: string, purpose: AttemptPurpose) {
  return authDatabase((tx) => recordAttempt(tx, identity, purpose));
}

export class SignInRateLimited extends Error { code = "rate_limit"; }

export async function checkCredentials(input: unknown) {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return null;
  const { allowed, account } = await authDatabase(async (tx) => {
    const allowed = await recordAttempt(tx, parsed.data.email, "sign-in");
    const account = allowed ? await tx.account.findUnique({
      where: { email: parsed.data.email }, include: { credential: true },
    }) : null;
    return { allowed, account };
  });
  if (!allowed) throw new SignInRateLimited();
  const valid = await compare(parsed.data.password, account?.credential?.passwordHash ??
    "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6Ttxl2zSA8uT4WhXjAhEoQy4O9i6W");
  if (!account || !valid || (emailVerificationRequired() && !account.emailVerified)) return null;
  const session = await authDatabase(async (tx) => {
    const session = await tx.authSession.create({
      data: { accountId: account.id, expiresAt: new Date(Date.now() + 7 * 86400000) },
    });
    await tx.$executeRaw`SELECT public.gochitral_auth_success(${attemptKey(parsed.data.email, "sign-in")})`;
    return session;
  });
  return { id: account.id, email: account.email, sid: session.id, accountRole: account.role };
}

export async function registerAccount(email: string, password: string, accountType: unknown) {
  const passwordHash = await hash(password, 12);
  return authDatabase((tx) => tx.account.create({
    data: {
      email: email.toLowerCase(), role: accountType === "manager" ? "manager" : "tourist",
      credential: { create: { passwordHash } },
    },
    select: { id: true, email: true },
  }));
}
