import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getPrisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { adminMfaRequired } from "./security";

class SessionExpired extends Error {}

export const session = cache(async () => {
  const verified = await auth();
  if (!verified?.user?.id || !verified.sid || !verified.accountRole) return null;
  // auth() has just checked this session and its MFA state against the database.
  return {
    user: { id: verified.user.id, email: verified.user.email },
    sessionId: verified.sid,
    account: { id: verified.user.id, email: verified.user.email, role: verified.accountRole },
    claims: { sub: verified.user.id, session_id: verified.sid, role: "authenticated", aal: verified.aal, admin_mfa_required: adminMfaRequired() },
  };
});

export async function userDatabase<T>(
  identity: NonNullable<Awaited<ReturnType<typeof session>>>,
  action: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel },
) {
  return getPrisma().$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL ROLE authenticated`;
    await tx.$queryRaw`SELECT set_config('request.jwt.claims', ${JSON.stringify(identity.claims)}, true)`;
    const active = await tx.$queryRaw<{ active: boolean }[]>`SELECT public.gochitral_session_active() AS active`;
    if (!active[0]?.active) throw new SessionExpired("Session expired");
    return action(tx);
  }, options);
}

export async function requireAccount(next = "/account") {
  const identity = await session();
  if (!identity) redirect(`/account/sign-in?next=${encodeURIComponent(next)}`);
  // Auth.js just read the active session and current protected account role.
  // Each data operation still checks session activity and RLS in userDatabase.
  return identity;
}

export async function requireRole(role: "manager" | "administrator", next: string) {
  const identity = await requireAccount(next);
  if (identity.account.role !== role) return null;
  if (role === "administrator" && adminMfaRequired() && identity.claims.aal !== "aal2") redirect("/account/mfa");
  return identity;
}
