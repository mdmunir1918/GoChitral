import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { authenticate, resetPassword, verifyMfa } from "../actions";
import { returnPath } from "@/lib/auth/return-path";
import { requireAccount } from "@/lib/auth/session";
import { MfaEnrollment } from "./setup-mfa";
import { authDatabase } from "@/lib/auth/store";
import { recoveryToken } from "@/lib/auth/tokens";
import { PasswordField } from "../password-field";
import { SubmitButton } from "../submit-button";
import { adminMfaRequired } from "@/lib/auth/security";

const titles = {
  "sign-in": "Sign in", register: "Create an account", "forgot-password": "Recover your password",
  "reset-password": "Choose a new password", mfa: "Authenticator security",
} as const;
const messages: Record<string, string> = {
  invalid: "Check the details and try again.",
  "password-invalid": "Use at least 8 characters, including a letter and a number.",
  failed: "We couldn’t complete that request. Check your details and try again.",
  "invalid-credentials": "The email or password is incorrect. Use your latest login details, or choose Forgot password to reset it.",
  "sign-in-unavailable": "Sign-in is temporarily unavailable. Please try again shortly.",
  "check-email": "If your email is eligible, you’ll receive a link to continue. Please check your inbox.",
  expired: "That link is invalid or has expired. Request a new one to continue.",
  "signed-out": "You are signed out.",
  "account-created": "Your account is ready. Sign in to continue.",
  "email-confirmed": "Your email is confirmed. Sign in to continue.",
  "password-changed": "Your password has been changed. Sign in with your new password.",
  "mail-unavailable": "We couldn’t complete registration. Please try again or contact the site administrator.",
  "rate-limit": "Too many attempts. Please try again in 15 minutes.",
};

export default async function AuthScreen({ params, searchParams }: PageProps<"/account/[screen]">) {
  const { screen } = await params;
  if (!Object.hasOwn(titles, screen)) notFound();
  const query = await searchParams;
  const next = returnPath(query.next);
  const draft = typeof query.draft === "string" ? `&draft=${encodeURIComponent(query.draft.slice(0, 36))}` : "";
  const message = typeof query.message === "string" ? messages[query.message] : undefined;
  if (screen === "reset-password") {
    const token = (await cookies()).get("gochitral-recovery")?.value;
    if (!token || !await recoveryToken(token)) redirect("/account/forgot-password?message=expired");
  }
  if (screen === "mfa") {
    if (!adminMfaRequired()) redirect("/account");
    const { user } = await requireAccount();
    const credential = await authDatabase((tx) => tx.authCredential.findUnique({ where: { accountId: user.id }, select: { mfaEnabled: true } }));
    return <>
      <h1>Authenticator security</h1>
      {message && <p role="status" className="auth-message">{message}</p>}
      {credential?.mfaEnabled ? <form action={verifyMfa}>
        <input type="hidden" name="factorId" value={user.id} />
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
      {screen !== "forgot-password" && <PasswordField newPassword={screen !== "sign-in"} />}
      {(screen === "register" || screen === "reset-password") && <p id="password-help">Use at least 8 characters.</p>}
      {screen === "register" && <label>Account type<select name="accountType" defaultValue={query.accountType === "manager" ? "manager" : "tourist"}><option value="tourist">Tourist</option><option value="manager">Hotel manager</option></select></label>}
      <SubmitButton label={screen === "forgot-password" ? "Send recovery link" : screen === "reset-password" ? "Save password" : titles[screen as keyof typeof titles]}
        pendingLabel={screen === "sign-in" ? "Signing in…" : screen === "register" ? "Creating account…" : "Please wait…"} />
    </form>
    <nav className="account-links" aria-label="Account options">
      <Link className="text-link" href={`/account/sign-in?next=${encodeURIComponent(next)}${draft}`}>Sign in</Link>
      <Link className="text-link" href={`/account/register?next=${encodeURIComponent(next)}${draft}`}>Create an account</Link>
      <Link className="text-link" href="/account/forgot-password">Forgot password?</Link>
    </nav>
  </>;
}
