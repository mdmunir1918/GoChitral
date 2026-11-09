import Link from "next/link";
import { requireRole, userDatabase } from "@/lib/auth/session";
import { categoryLabels, type Category } from "@/features/catalogue/types";

export const metadata = { title: "Administrator workspace" };

export default async function Admin({ searchParams }: PageProps<"/admin">) {
  const identity = await requireRole("administrator", "/admin");
  if (!identity) return <><h1>Access denied</h1><p>This workspace requires an administrator account.</p></>;
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
  return <>
    <h1>Publishing workspace</h1>
    <div className="admin-toolbar">
      <nav className="admin-categories" aria-label="Moderation categories">
        <Link href="/admin" aria-current={!selected ? "page" : undefined}>All listings</Link>
        {Object.entries(categoryLabels).map(([value, label]) => <Link key={value} href={`/admin?category=${value}`} aria-current={selected === value ? "page" : undefined}>{label}</Link>)}
      </nav>
      <Link className="browse-link" href={`/admin/listings/new?category=${selected ?? "destinations"}`}>Create listing →</Link>
    </div>
    <p>{total} listings · Drafts and pending revisions require review.</p>
    <div className="moderation-list">{listings.map((listing) => <article key={listing.id}>
      <div><h2><Link href={`/admin/listings/${listing.id}`}>{listing.title}</Link></h2><p>{categoryLabels[listing.category]} · {listing.location}</p></div>
      <div><p>{listing.status} · Revision {listing.version}</p><p>{listing.revision && listing.revision.status !== "approved" ? `${listing.revision.status} revision awaiting review` : listing.status === "draft" ? "Draft content awaiting review" : "Approved content"}</p></div>
      <Link className="text-link" href={`/admin/listings/${listing.id}`}>Review listing</Link>
    </article>)}</div>
    {!listings.length && <p>No listings in this queue.</p>}
    {pages > 1 && <nav className="admin-categories" aria-label="Moderation queue pages">
      {page > 1 && <Link className="text-link" href={pageUrl(page - 1)}>← Previous</Link>}
      <span>Page {page} of {pages}</span>
      {page < pages && <Link className="text-link" href={pageUrl(page + 1)}>Next →</Link>}
    </nav>}
  </>;
}
