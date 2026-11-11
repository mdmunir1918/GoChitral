import Link from "next/link";
import { requireRole, userDatabase } from "@/lib/auth/session";
import { readAdminDashboardMetrics } from "@/features/admin/dashboard";
import { categoryLabels, type Category } from "@/features/catalogue/types";

export const metadata = { title: "Administrator dashboard" };

function Metric({ label, value, note }: { label: string; value: number; note?: string }) {
  return <article className="admin-metric"><p>{label}</p><strong>{value.toLocaleString()}</strong>{note && <small>{note}</small>}</article>;
}

function MetricList({ title, values, labels }: { title: string; values: Record<string, number>; labels?: Record<string, string> }) {
  const entries = Object.entries(values);
  const max = Math.max(1, ...entries.map(([, count]) => count));
  return <section className="admin-panel"><h2>{title}</h2>{entries.length ? <ul className="admin-bars">{entries.map(([key, count]) => <li key={key}>
    <span>{labels?.[key] ?? key.replaceAll("_", " ")}</span><strong>{count.toLocaleString()}</strong>
    <span className="admin-bar-track" aria-hidden="true"><span style={{ width: `${Math.max(count ? 3 : 0, Math.round(count / max * 100))}%` }} /></span>
  </li>)}</ul> : <p>No records yet.</p>}</section>;
}

export default async function Admin({ searchParams }: PageProps<"/admin">) {
  const identity = await requireRole("administrator", "/admin");
  if (!identity) return <><h1>Access denied</h1><p>This workspace requires an administrator account.</p></>;
  const metrics = await readAdminDashboardMetrics(identity);
  const { category, page: requestedPage } = await searchParams;
  const selected = typeof category === "string" && Object.hasOwn(categoryLabels, category) ? category as Category : undefined;
  const { listings, total, page, pages } = await userDatabase(identity, async (tx) => {
    const total = await tx.listing.count({ where: { category: selected } });
    const pages = Math.max(1, Math.ceil(total / 50));
    const page = typeof requestedPage === "string" && /^\d+$/.test(requestedPage) ? Math.min(pages, Math.max(1, Number(requestedPage))) : 1;
    const listings = await tx.listing.findMany({
      where: { category: selected }, include: { revision: { select: { status: true, version: true } } },
      orderBy: [{ status: "asc" }, { title: "asc" }, { id: "asc" }], take: 50, skip: (page - 1) * 50,
    });
    return { listings, total, page, pages };
  });
  const pageUrl = (value: number) => `/admin?page=${value}${selected ? `&category=${selected}` : ""}`;
  const statusLabels = { draft: "Draft", published: "Published", suspended: "Suspended" };
  const roleLabels = { tourist: "Tourists", manager: "Hotel managers", administrator: "Administrators" };

  return <>
    <header className="admin-dashboard-heading"><p className="eyebrow">GoChitral operations</p><h1>Admin dashboard</h1><p>Current catalogue, trip and review activity. Counts only; traveller profiles and trip details stay private.</p></header>
    <section className="admin-metric-grid" aria-label="Key totals">
      <Metric label="Accounts" value={metrics.accounts.total} />
      <Metric label="Saved trips" value={metrics.trips.total} note={`${metrics.trips.savedLast30Days} saved in the last 30 days`} />
      <Metric label="Catalogue listings" value={metrics.listings.total} />
      <Metric label="Listing revisions to review" value={metrics.listings.pendingRevisions} />
    </section>

    <nav className="admin-queue-links" aria-label="Administrator workspaces">
      <Link href="#listings">Review listings <span>{metrics.listings.byStatus.draft ?? 0} drafts</span></Link>
      <Link href="/admin/hotels">Review hotel submissions <span>{metrics.hotelSubmissions.pending ?? 0} waiting</span></Link>
      <Link href="/admin/guide-requests">Review guide requests <span>{metrics.guideRequests.pending ?? 0} pending</span></Link>
      <Link href="/admin/knowledge">Manage reviewed answers <span>Sources, review dates and expiry</span></Link>
    </nav>

    <section className="admin-analytics-grid" aria-label="Platform analytics">
      <MetricList title="Accounts by role" values={metrics.accounts.byRole} labels={roleLabels} />
      <MetricList title="Listings by category" values={metrics.listings.byCategory} labels={categoryLabels} />
      <MetricList title="Listings by status" values={metrics.listings.byStatus} labels={statusLabels} />
      <MetricList title="Hotel submissions" values={metrics.hotelSubmissions} />
      <MetricList title="Guide requests" values={metrics.guideRequests} />
      <section className="admin-panel"><h2>Last 30 days</h2><div className="admin-activity"><p><strong>{metrics.moderation.listingActionsLast30Days.toLocaleString()}</strong><span>listing moderation actions</span></p><p><strong>{metrics.moderation.guideDecisionsLast30Days.toLocaleString()}</strong><span>guide request decisions</span></p></div></section>
    </section>
    <p className="admin-privacy-note">These reports show totals only. They do not display emails, passwords, verification evidence or saved-trip contents.</p>

    <section className="admin-permissions admin-panel" aria-labelledby="permission-heading">
      <p className="eyebrow">Access rules</p><h2 id="permission-heading">Who can do what</h2>
      <div className="admin-table-wrap"><table><thead><tr><th scope="col">Role</th><th scope="col">Allowed actions</th><th scope="col">Limits</th></tr></thead><tbody>
        <tr><th scope="row">Guest</th><td>Browse published places, stays, activities and guides; prepare a trip draft.</td><td>No account or private trip access.</td></tr>
        <tr><th scope="row">Tourist</th><td>Save and manage own trips; submit guide requests; view own request status.</td><td>Cannot access another traveller’s trips or review queues.</td></tr>
        <tr><th scope="row">Hotel manager</th><td>Edit own hotel draft, rooms and photos; submit changes for review.</td><td>Cannot approve or publish listings, or change another manager’s data.</td></tr>
        <tr><th scope="row">Administrator</th><td>Review listings and hotels; publish or suspend catalogue entries; decide guide requests; manage sourced visitor answers; view aggregate reports.</td><td>Changes are permission checked and audited. Account credentials and private trip content are not shown here.</td></tr>
      </tbody></table></div>
    </section>

    <section id="listings" className="admin-listing-queue">
      <h2>Catalogue review</h2>
      <div className="admin-toolbar">
        <nav className="admin-categories" aria-label="Moderation categories">
          <Link href="/admin#listings" aria-current={!selected ? "page" : undefined}>All listings</Link>
          {Object.entries(categoryLabels).map(([value, label]) => <Link key={value} href={`/admin?category=${value}#listings`} aria-current={selected === value ? "page" : undefined}>{label}</Link>)}
        </nav>
        <Link className="browse-link" href={`/admin/listings/new?category=${selected ?? "destinations"}`}>Create listing →</Link>
      </div>
      <p>{total} listings · Drafts and pending revisions require review.</p>
      <div className="moderation-list">{listings.map((listing) => <article key={listing.id}>
        <div><h3><Link href={`/admin/listings/${listing.id}`}>{listing.title}</Link></h3><p>{categoryLabels[listing.category]} · {listing.location}</p></div>
        <div><p>{listing.status} · Revision {listing.version}</p><p>{listing.revision && listing.revision.status !== "approved" ? `${listing.revision.status} revision awaiting review` : listing.status === "draft" ? "Draft content awaiting review" : "Approved content"}</p></div>
        <Link className="text-link" href={`/admin/listings/${listing.id}`}>Review listing</Link>
      </article>)}</div>
      {!listings.length && <p>No listings in this queue.</p>}
      {pages > 1 && <nav className="admin-categories" aria-label="Moderation queue pages">
        {page > 1 && <Link className="text-link" href={pageUrl(page - 1)}>← Previous</Link>}
        <span>Page {page} of {pages}</span>
        {page < pages && <Link className="text-link" href={pageUrl(page + 1)}>Next →</Link>}
      </nav>}
    </section>
  </>;
}
