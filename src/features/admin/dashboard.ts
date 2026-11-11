import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { userDatabase } from "@/lib/auth/session";
import type { session } from "@/lib/auth/session";

export type AdminDashboardMetrics = {
  accounts: { total: number; byRole: Record<string, number> };
  trips: { total: number; savedLast30Days: number };
  listings: {
    total: number;
    byStatus: Record<string, number>;
    byCategory: Record<string, number>;
    pendingRevisions: number;
  };
  hotelSubmissions: Record<string, number>;
  guideRequests: Record<string, number>;
  moderation: { listingActionsLast30Days: number; guideDecisionsLast30Days: number };
};

export async function readAdminDashboardMetrics(identity: NonNullable<Awaited<ReturnType<typeof session>>>) {
  return userDatabase(identity, async (tx: Prisma.TransactionClient) => {
    const rows = await tx.$queryRaw<{ metrics: AdminDashboardMetrics }[]>`
      SELECT gochitral_private.admin_dashboard_metrics() AS metrics
    `;
    if (!rows[0]?.metrics) throw new Error("Admin dashboard metrics are unavailable.");
    return rows[0].metrics;
  });
}
