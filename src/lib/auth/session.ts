import "server-only";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { authClient } from "./supabase";

class SessionExpired extends Error {}

export async function session() {
  const supabase = await authClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: { session: tokens } } = await supabase.auth.getSession();
  if (!tokens) return null;
  // getUser has verified the access token with Supabase before its claims are used.
  const claims = JSON.parse(Buffer.from(tokens.access_token.split(".")[1], "base64url").toString());
  if (claims.sub !== user.id || typeof claims.session_id !== "string") return null;
  return { supabase, user, claims };
}

export async function userDatabase<T>(
  identity: NonNullable<Awaited<ReturnType<typeof session>>>,
  action: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return getPrisma().$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL ROLE authenticated`;
    await tx.$queryRaw`SELECT set_config('request.jwt.claims', ${JSON.stringify(identity.claims)}, true)`;
    const active = await tx.$queryRaw<{ active: boolean }[]>`SELECT public.gochitral_session_active() AS active`;
    if (!active[0]?.active) throw new SessionExpired("Session expired");
    return action(tx);
  });
}

export async function requireAccount(next = "/account") {
  const identity = await session();
  if (!identity) redirect(`/account/sign-in?next=${encodeURIComponent(next)}`);
  let account;
  try {
    account = await userDatabase(identity, (tx) => tx.account.findUnique({ where: { id: identity.user.id } }));
  } catch (error) {
    if (error instanceof SessionExpired) redirect(`/account/sign-in?next=${encodeURIComponent(next)}`);
    throw error;
  }
  if (!account) throw new Error("Your account profile is unavailable.");
  return { ...identity, account };
}

export async function requireRole(role: "manager" | "administrator", next: string) {
  const identity = await requireAccount(next);
  if (identity.account.role !== role) return null;
  if (role === "administrator" && identity.claims.aal !== "aal2") redirect("/account/mfa");
  return identity;
}
