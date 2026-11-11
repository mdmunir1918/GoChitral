import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, userDatabase } from "@/lib/auth/session";
import { categoryLabels, type Category } from "@/features/catalogue/types";
import { editorData, editorOptions } from "@/features/publishing/read";
import { reviewDateToday, type ListingContent } from "@/features/publishing/validation";
import { ListingEditor } from "../../editor";

export const metadata = { title: "Edit catalogue listing" };

export default async function EditListing({ params, searchParams }: PageProps<"/admin/listings/[id]">) {
  const { id } = await params;
  const identity = await requireRole("administrator", "/admin");
  if (!identity) return <><h1>Access denied</h1><p>Administrator access is required.</p></>;
  const { category } = await searchParams;
  const selected: Category = typeof category === "string" && Object.hasOwn(categoryLabels, category) ? category as Category : "destinations";
  const data = await userDatabase(identity, async (tx) => ({
    options: await editorOptions(tx, id === "new" ? undefined : id),
    existing: id === "new" ? null : await editorData(tx, id),
  }));
  if (id !== "new" && !data.existing) notFound();
  const initial: ListingContent = data.existing?.content ?? {
    category: selected, slug: "", title: "", location: "", summary: "", description: "", visitorNote: "",
    reviewed: reviewDateToday(), photoId: "", destinationId: "",
    sourceTitle: "", sourceUrl: "", contactUrl: "", latitude: "", longitude: "",
    guideLanguages: "", guideExpertise: "", guideAreasServed: "", guideCredentialSummary: "", guidePricingUnit: "per_group_day",
  };
  const listing = data.existing?.listing;
  return <>
    <Link className="text-link" href="/admin">← Publishing queues</Link>
    <h1>{listing ? "Edit listing" : "Create listing"}</h1>
    <ListingEditor initial={initial} listingId={listing?.id ?? ""} version={listing?.version ?? 0}
      status={listing?.status ?? "draft"} evidence={listing?.verification?.evidence ?? ""} {...data.options} />
    {listing && <section className="audit-history"><h2>Audit history</h2>
      <ol>{listing.audits.map((audit) => <li key={audit.id}>
        <strong>{audit.action} · Revision {audit.revision}</strong>
        <p>{audit.reason}</p>
        <p><time dateTime={audit.createdAt.toISOString()}>{audit.createdAt.toLocaleString("en-GB", { timeZone: "Asia/Karachi" })} Pakistan time</time></p>
        <p>Actor · {audit.actorId}</p>
        {audit.action === "suspend" && <p>Dependent trips at suspension · {audit.dependentTripCount}</p>}
      </li>)}</ol>
      {!listing.audits.length && <p>No moderation decisions recorded yet.</p>}
    </section>}
  </>;
}
