import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { authenticate, resetPassword, verifyMfa } from "../actions";
import { returnPath } from "@/lib/auth/return-path";
import { requireAccount } from "@/lib/auth/session";
import { MfaEnrollment } from "./setup-mfa";

const titles = {
  "sign-in": "Sign in", register: "Create an account", "forgot-password": "Recover your password",
  "reset-password": "Choose a new password", mfa: "Authenticator security",
} as const;
const messages: Record<string, string> = {
  invalid: "Check the details and try again. New passwords need at least 12 characters.",
  failed: "We couldn’t complete that request. Check your details and try again.",
  "check-email": "If your email is eligible, you’ll receive a link to continue. Please check your inbox.",
  expired: "That link is invalid or has expired. Request a new one to continue.",
  "signed-out": "You are signed out.",
  "rate-limit": "Too many attempts. Please try again in 15 minutes.",
  over_email_send_rate_limit: "Registration is temporarily unavailable because the email service has reached its sending limit. Please try again later or contact the site administrator.",
  over_request_rate_limit: "The sign-up service is receiving too many requests. Please wait a few minutes and try again.",
  email_address_not_authorized: "The email service currently permits registration only for approved test addresses. Contact the site administrator to enable email delivery for your address.",
  email_address_invalid: "The email service could not accept that email address. Please use a valid personal email address.",
  weak_password: "Please choose a stronger password with at least 12 characters.",
  signup_disabled: "Registration is currently disabled. Please contact the site administrator.",
  email_provider_disabled: "Email registration is currently disabled. Please contact the site administrator.",
};

export default async function AuthScreen({ params, searchParams }: PageProps<"/account/[screen]">) {
  const { screen } = await params;
  if (!Object.hasOwn(titles, screen)) notFound();
  const query = await searchParams;
  const next = returnPath(query.next);
  const draft = typeof query.draft === "string" ? `&draft=${encodeURIComponent(query.draft.slice(0, 36))}` : "";
  const message = typeof query.message === "string" ? messages[query.message] : undefined;
  if (screen === "reset-password") {
    await requireAccount();
    if ((await cookies()).get("gochitral-recovery")?.value !== "verified") redirect("/account/forgot-password?message=expired");
  }
  if (screen === "mfa") {
    const { supabase } = await requireAccount();
    const { data } = await supabase.auth.mfa.listFactors();
    const factor = data?.totp.find((item) => item.status === "verified");
    return <>
      <h1>Authenticator security</h1>
      {message && <p role="status" className="auth-message">{message}</p>}
      {factor ? <form action={verifyMfa}>
        <input type="hidden" name="factorId" value={factor.id} />
        <label>Authenticator code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /></label>
        <button type="submit">Verify code</button>
      </form> : <MfaEnrollment />}
      <Link href="/account" className="text-link">Return to your account</Link>
    </>;
  }
  return <>
    <h1>{titles[screen as keyof typeof titles]}</h1>
    {message && <p className="auth-message" role="status">{message}</p>}
    <form action={screen === "reset-password" ? resetPassword : authenticate}>
      <input type="hidden" name="mode" value={screen} />
      <input type="hidden" name="next" value={next} />
      {typeof query.draft === "string" && <input type="hidden" name="draft" value={query.draft.slice(0, 36)} />}
      {screen !== "reset-password" && <label>Email<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>}
      {screen !== "forgot-password" && <label>Password<input name="password" type="password"
        aria-describedby={screen === "sign-in" ? undefined : "password-help"}
        autoComplete={screen === "sign-in" ? "current-password" : "new-password"} minLength={screen === "sign-in" ? 1 : 12} maxLength={128} required /></label>}
      {(screen === "register" || screen === "reset-password") && <p id="password-help">Use at least 12 characters for your password.</p>}
      {screen === "register" && <label>Account type<select name="accountType" defaultValue={query.accountType === "manager" ? "manager" : "tourist"}><option value="tourist">Tourist</option><option value="manager">Hotel manager</option></select></label>}
      <button type="submit">{screen === "forgot-password" ? "Send recovery link" : screen === "reset-password" ? "Save password" : titles[screen as keyof typeof titles]}</button>
    </form>
    <nav className="account-links" aria-label="Account options">
      <Link className="text-link" href={`/account/sign-in?next=${encodeURIComponent(next)}${draft}`}>Sign in</Link>
      <Link className="text-link" href={`/account/register?next=${encodeURIComponent(next)}${draft}`}>Create an account</Link>
      <Link className="text-link" href="/account/forgot-password">Forgot password?</Link>
    </nav>
  </>;
}
