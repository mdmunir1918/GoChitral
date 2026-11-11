"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return <>
    <button type="submit" disabled={pending} aria-disabled={pending}>{pending ? pendingLabel : label}</button>
    {pending && <p role="status">Please wait while we check your request.</p>}
  </>;
}
