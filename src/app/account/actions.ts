"use server";

import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError, CredentialsSignin } from "next-auth";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { authSignIn, authSignOut } from "@/auth";
import { requireAccount } from "@/lib/auth/session";
import { returnPath } from "@/lib/auth/return-path";
import { authDatabase } from "@/lib/auth/store";
import { attemptAllowed, emailSchema, newPasswordSchema, registerAccount } from "@/lib/auth/credentials";
import { decryptMfa, emailVerificationRequired, encryptMfa, newMfaSecret, totpStep } from "@/lib/auth/security";
import { changeRecoveredPassword, issueAccountLink } from "@/lib/auth/tokens";

async function originCheck() {
  if ((await headers()).get("origin") !== process.env.APP_ORIGIN) throw new Error("This request origin is not permitted.");
}

export async function authenticate(form: FormData) {
  await originCheck();
  const mode = z.enum(["sign-in", "register", "forgot-password"]).safeParse(form.get("mode"));
  if (!mode.success) redirect("/account/sign-in");
  const email = emailSchema.safeParse(form.get("email"));
  if (!email.success) redirect(`/account/${mode.data}?message=invalid`);
  const next = returnPath(form.get("next"));
  const draft = z.uuid().safeParse(form.get("draft"));
  const resume = draft.success ? `${next.split("?")[0]}?draft=${draft.data}` : next;
  const registrationFailure = (message: string) => `/account/register?message=${message}&accountType=${form.get("accountType") === "manager" ? "manager" : "tourist"}&next=${encodeURIComponent(next)}${draft.success ? `&draft=${draft.data}` : ""}`;
  if (mode.data === "forgot-password") {
    if (await attemptAllowed(email.data, "recovery")) {
      const account = await authDatabase((tx) => tx.account.findUnique({ where: { email: email.data }, select: { id: true } }));
      if (account) {
        try { await issueAccountLink(account.id, email.data, "recovery"); }
        catch { console.error("Recovery email delivery failed."); }
      }
    }
    redirect("/account/forgot-password?message=check-email");
  }
  const password = (mode.data === "register" ? newPasswordSchema : z.string().min(1).max(128)).safeParse(form.get("password"));
  if (!password.success) redirect(mode.data === "register" ? registrationFailure("password-invalid") : `/account/${mode.data}?message=invalid`);
  if (mode.data === "register") {
    if (!await attemptAllowed(email.data, "register")) redirect(registrationFailure("rate-limit"));
    try {
      const account = await registerAccount(email.data, password.data, form.get("accountType"));
      if (emailVerificationRequired()) await issueAccountLink(account.id, account.email, "email");
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) {
        redirect(registrationFailure("mail-unavailable"));
      }
      if (emailVerificationRequired()) {
        const existing = await authDatabase((tx) => tx.account.findUnique({ where: { email: email.data }, select: { id: true, emailVerified: true } }));
        if (existing && !existing.emailVerified) {
          try { await issueAccountLink(existing.id, email.data, "email"); }
          catch { redirect(registrationFailure("mail-unavailable")); }
        }
      }
    }
    redirect(emailVerificationRequired() ? "/account/sign-in?message=check-email" : `/account/sign-in?message=account-created&next=${encodeURIComponent(resume)}`);
  }
  try {
    await authSignIn("credentials", { email: email.data, password: password.data, redirectTo: resume });
  } catch (error) {
    if (error instanceof CredentialsSignin && error.code === "rate_limit") redirect(`/account/sign-in?message=rate-limit&next=${encodeURIComponent(next)}`);
    if (error instanceof CredentialsSignin) redirect(`/account/sign-in?message=invalid-credentials&next=${encodeURIComponent(next)}${draft.success ? `&draft=${draft.data}` : ""}`);
    if (error instanceof AuthError) redirect(`/account/sign-in?message=sign-in-unavailable&next=${encodeURIComponent(next)}`);
    throw error;
  }
}

export async function signOut() {
  await originCheck();
  const identity = await requireAccount();
  await authDatabase((tx) => tx.authSession.updateMany({ where: { accountId: identity.user.id, revokedAt: null }, data: { revokedAt: new Date() } }));
  (await cookies()).delete("gochitral-recovery");
  await authSignOut({ redirectTo: "/account/sign-in?message=signed-out" });
}

export async function resetPassword(form: FormData) {
  await originCheck();
  const jar = await cookies();
  const token = jar.get("gochitral-recovery")?.value;
  const password = newPasswordSchema.safeParse(form.get("password"));
  if (!password.success) redirect("/account/reset-password?message=password-invalid");
  if (!token || !await changeRecoveredPassword(token, password.data)) redirect("/account/forgot-password?message=expired");
  jar.delete("gochitral-recovery");
  await authSignOut({ redirectTo: "/account/sign-in?message=password-changed" });
}

export async function enrollMfa() {
  await originCheck();
  const { user } = await requireAccount();
  const secret = newMfaSecret();
  const updated = await authDatabase((tx) => tx.authCredential.updateMany({
    where: { accountId: user.id, mfaEnabled: false },
    data: { mfaSecretEncrypted: encryptMfa(secret), lastTotpStep: null },
  }));
  if (!updated.count) return { error: "An authenticator is already enrolled. Enter its current code." };
  return { factorId: user.id, secret };
}

export async function verifyMfa(form: FormData) {
  await originCheck();
  const identity = await requireAccount();
  if (!await attemptAllowed(identity.user.id, "mfa")) redirect("/account/mfa?message=rate-limit");
  const code = z.string().regex(/^\d{6}$/).safeParse(form.get("code"));
  if (!code.success || form.get("factorId") !== identity.user.id) redirect("/account/mfa?message=invalid");
  const verified = await authDatabase(async (tx) => {
    const credential = await tx.authCredential.findUnique({ where: { accountId: identity.user.id } });
    if (!credential?.mfaSecretEncrypted) return false;
    const step = totpStep(decryptMfa(credential.mfaSecretEncrypted), code.data);
    if (step === null) return false;
    const changed = await tx.authCredential.updateMany({
      where: { accountId: identity.user.id, OR: [{ lastTotpStep: null }, { lastTotpStep: { lt: step } }] },
      data: { mfaEnabled: true, lastTotpStep: step },
    });
    if (changed.count !== 1) return false;
    await tx.authSession.update({ where: { id: identity.sessionId }, data: { mfaVerifiedAt: new Date() } });
    return true;
  });
  if (!verified) redirect("/account/mfa?message=failed");
  redirect("/account");
}
