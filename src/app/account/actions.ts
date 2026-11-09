"use server";

import { createHash } from "node:crypto";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { authClient } from "@/lib/auth/supabase";
import { requireAccount } from "@/lib/auth/session";
import { returnPath } from "@/lib/auth/return-path";

async function originCheck() {
  const origin = (await headers()).get("origin");
  if (origin !== process.env.APP_ORIGIN) throw new Error("This request origin is not permitted.");
}

async function rateLimit(email: string) {
  const key = createHash("sha256").update(email.toLowerCase()).digest("hex");
  const result = await getPrisma().$queryRaw<{ allowed: boolean }[]>`SELECT public.gochitral_auth_attempt(${key}) AS allowed`;
  if (!result[0]?.allowed) redirect("/account/sign-in?message=rate-limit");
}

export async function authenticate(form: FormData) {
  await originCheck();
  const mode = form.get("mode");
  if (!["sign-in", "register", "forgot-password"].includes(String(mode))) redirect("/account/sign-in");
  const email = z.email().max(254).safeParse(form.get("email"));
  if (!email.success) redirect(`/account/${mode}?message=invalid`);
  await rateLimit(email.data);
  const next = returnPath(form.get("next"));
  const jar = await cookies();
  const draft = z.uuid().safeParse(form.get("draft"));
  const resume = draft.success ? `${next.split("?")[0]}?draft=${draft.data}` : next;
  jar.set("gochitral-return", resume, {
    httpOnly: true, sameSite: "lax", secure: process.env.APP_ORIGIN?.startsWith("https://"), maxAge: 900, path: "/",
  });
  const supabase = await authClient();
  if (mode === "forgot-password") {
    await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${process.env.APP_ORIGIN}/auth/confirm` });
    redirect("/account/forgot-password?message=check-email");
  }
  const password = z.string().min(mode === "register" ? 12 : 1).max(128).safeParse(form.get("password"));
  if (!password.success) redirect(`/account/${mode}?message=invalid`);
  if (mode === "register") {
    const accountType = form.get("accountType") === "manager" ? "manager" : "tourist";
    const { error } = await supabase.auth.signUp({
      email: email.data, password: password.data,
      options: { data: { account_type: accountType }, emailRedirectTo: `${process.env.APP_ORIGIN}/auth/confirm` },
    });
    if (error) {
      const codes = ["over_email_send_rate_limit", "over_request_rate_limit",
        "email_address_not_authorized", "email_address_invalid", "weak_password", "signup_disabled", "email_provider_disabled"];
      const message = error.code && codes.includes(error.code) ? error.code : "failed";
      redirect(`/account/register?message=${message}&accountType=${accountType}&next=${encodeURIComponent(next)}${draft.success ? `&draft=${draft.data}` : ""}`);
    }
    redirect("/account/sign-in?message=check-email");
  }
  const { error } = await supabase.auth.signInWithPassword({ email: email.data, password: password.data });
  if (error) redirect(`/account/sign-in?message=failed&next=${encodeURIComponent(next)}${draft.success ? `&draft=${draft.data}` : ""}`);
  jar.delete("gochitral-return");
  redirect(resume);
}

export async function signOut() {
  await originCheck();
  const supabase = await authClient();
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) throw new Error("Sign out could not be completed. Please try again.");
  (await cookies()).delete("gochitral-return");
  (await cookies()).delete("gochitral-recovery");
  redirect("/account/sign-in?message=signed-out");
}

export async function resetPassword(form: FormData) {
  await originCheck();
  await requireAccount();
  const jar = await cookies();
  if (jar.get("gochitral-recovery")?.value !== "verified") redirect("/account/forgot-password?message=expired");
  const password = z.string().min(12).max(128).safeParse(form.get("password"));
  if (!password.success) redirect("/account/reset-password?message=invalid");
  const supabase = await authClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) redirect("/account/reset-password?message=failed");
  jar.delete("gochitral-recovery");
  await signOut();
}

export async function enrollMfa() {
  await originCheck();
  const { supabase } = await requireAccount();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  if (factors?.totp.some((factor) => factor.status === "verified")) return { error: "An authenticator is already enrolled. Enter its current code." };
  for (const factor of factors?.totp ?? []) await supabase.auth.mfa.unenroll({ factorId: factor.id });
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "GoChitral" });
  if (error) return { error: "Authenticator setup failed. Please try again." };
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

export async function verifyMfa(form: FormData) {
  await originCheck();
  const { supabase, user } = await requireAccount();
  await rateLimit(user.id);
  const code = z.string().regex(/^\d{6}$/).safeParse(form.get("code"));
  const factorId = z.uuid().safeParse(form.get("factorId"));
  if (!code.success || !factorId.success) redirect("/account/mfa?message=invalid");
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factorId.data, code: code.data });
  if (error) redirect("/account/mfa?message=failed");
  redirect("/account");
}
