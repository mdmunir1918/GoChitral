import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import type { AdminDashboardMetrics } from "../src/features/admin/dashboard";

config({ path: [".env.local", ".env"], quiet: true });
if (!process.env.DIRECT_URL) throw new Error("Set DIRECT_URL for the dashboard verification database.");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }) });
const adminId = randomUUID(), touristId = randomUUID();
const adminSession = randomUUID(), touristSession = randomUUID();

async function asRole<T>(accountId: string, sessionId: string, action: (tx: Prisma.TransactionClient) => Promise<T>) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL ROLE authenticated`;
    await tx.$queryRaw`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: accountId, session_id: sessionId, role: "authenticated", aal: "aal1", admin_mfa_required: false })}, true)`;
    const active = await tx.$queryRaw<{ active: boolean }[]>`SELECT public.gochitral_session_active() AS active`;
    assert.equal(active[0]?.active, true);
    return action(tx);
  });
}

async function verify() {
  try {
    await db.account.createMany({ data: [
      { id: adminId, email: `dashboard-admin-${adminId}@example.invalid`, role: "administrator" },
      { id: touristId, email: `dashboard-tourist-${touristId}@example.invalid`, role: "tourist" },
    ] });
    await db.authSession.createMany({ data: [
      { id: adminSession, accountId: adminId, expiresAt: new Date(Date.now() + 60_000) },
      { id: touristSession, accountId: touristId, expiresAt: new Date(Date.now() + 60_000) },
    ] });

    const rows = await asRole(adminId, adminSession, (tx) => tx.$queryRaw<{ metrics: AdminDashboardMetrics }[]>`
      SELECT gochitral_private.admin_dashboard_metrics() AS metrics
    `);
    const metrics = rows[0]?.metrics;
    assert(metrics);
    assert(metrics.accounts.total >= 2);
    assert(metrics.trips.total >= 0 && metrics.trips.savedLast30Days >= 0);
    assert(metrics.listings.total >= 0 && metrics.listings.pendingRevisions >= 0);
    assert(metrics.hotelSubmissions && metrics.guideRequests && metrics.moderation);
    const serialized = JSON.stringify(metrics);
    assert(!serialized.includes("@example.invalid"), "Dashboard data must not contain account emails.");
    assert(!/password|credential|ownerId|tripId/i.test(serialized), "Dashboard data must not contain private account or trip fields.");

    await assert.rejects(asRole(touristId, touristSession, (tx) => tx.$queryRaw`
      SELECT gochitral_private.admin_dashboard_metrics()
    `), /Administrator access required|42501|insufficient_privilege/i);
    await assert.rejects(db.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL ROLE gochitral_public`;
      return tx.$queryRaw`SELECT gochitral_private.admin_dashboard_metrics()`;
    }), /permission|42501|insufficient_privilege/i);

    console.log("Admin dashboard: aggregate metrics available to an active administrator; tourist and public roles denied; no private account or trip data returned.");
  } finally {
    await db.authSession.deleteMany({ where: { accountId: { in: [adminId, touristId] } } });
    await db.account.deleteMany({ where: { id: { in: [adminId, touristId] } } });
    await db.$disconnect();
    console.log("Temporary dashboard accounts and sessions removed.");
  }
}

verify();
