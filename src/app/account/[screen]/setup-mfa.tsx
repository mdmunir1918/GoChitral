"use client";
import { useState } from "react";
import { enrollMfa, verifyMfa } from "../actions";

export function MfaEnrollment() {
  const [setup, setSetup] = useState<Awaited<ReturnType<typeof enrollMfa>>>();
  const [pending, setPending] = useState(false);
  return <>
    <p>Add GoChitral to an authenticator app, then enter the six-digit code. Administrator access requires a verified authenticator.</p>
    {!setup?.factorId && <button disabled={pending} onClick={async () => {
      setPending(true);
      try { setSetup(await enrollMfa()); } finally { setPending(false); }
    }}>{pending ? "Preparing…" : "Set up authenticator"}</button>}
    {setup?.error && <p role="alert">{setup.error}</p>}
    {setup?.factorId && <>
      <p className="mfa-secret">Setup key · <code>{setup.secret}</code></p>
      <form action={verifyMfa}>
        <input name="factorId" type="hidden" value={setup.factorId} />
        <label>Authenticator code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /></label>
        <button type="submit">Verify authenticator</button>
      </form>
    </>}
  </>;
}
