import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, userDatabase } from "@/lib/auth/session";
import { emptyHotel } from "@/features/hotels/validation";
import { HotelEditor } from "../../hotel-editor";
export const metadata = { title: "Edit your hotel" };
export default async function EditHotel({ params }: PageProps<"/manager/hotels/[id]">) {
  const { id } = await params;
  const identity = await requireRole("manager", "/manager/hotels");
  if (!identity) return <><h1>Access denied</h1><p>A hotel manager account is required.</p></>;
  const data = await userDatabase(identity, async (tx) => ({
    draft: id === "new" ? null : await tx.hotelDraft.findFirst({ where: { id, ownerId: identity.user.id }, include: { rooms: { orderBy: { id: "asc" } }, photos: { where: { inDraft: true }, orderBy: { createdAt: "asc" }, select: { id: true, width: true, height: true } } } }),
    destinations: await tx.listing.findMany({ where: { category: "destinations", status: "published" }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
    published: id === "new" ? null : await tx.listing.findUnique({ where: { id }, select: { slug: true, status: true } }),
  }));
  if (id !== "new" && !data.draft) notFound();
  const draft = data.draft;
  const initial = draft ? { title: draft.title, destinationId: draft.destinationId, contactUrl: draft.contactUrl, summary: draft.summary, description: draft.description, visitorNote: draft.visitorNote, amenities: draft.amenities,
    rooms: draft.rooms.map((r) => ({ id: r.id, title: r.title, capacity: r.capacity, nightlyRate: (r.nightlyMinor / 100).toFixed(2), availabilityNote: r.availabilityNote, archived: r.archived })) } : emptyHotel;
  return <><Link href="/manager/hotels">← Your hotels</Link><h1>{draft ? "Edit your hotel" : "Create a hotel"}</h1>
    {data.published?.status === "published" && <p><Link href={`/hotels/${data.published.slug}`}>View approved public hotel</Link></p>}
    <HotelEditor initial={initial} id={draft?.id ?? ""} version={draft?.version ?? 0} status={draft?.status ?? "draft"} reviewNote={draft?.reviewNote ?? ""} photos={draft?.photos ?? []} destinations={data.destinations} />
  </>;
}
