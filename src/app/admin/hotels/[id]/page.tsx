import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, userDatabase } from "@/lib/auth/session";
import { HotelOverview } from "@/features/hotels/overview";
import { HotelReviewForm } from "../review-form";
export const metadata = { title: "Review hotel submission" };
export default async function ReviewHotel({ params }: PageProps<"/admin/hotels/[id]">) {
  const { id } = await params;
  const identity = await requireRole("administrator", "/admin/hotels");
  if (!identity) return <><h1>Access denied</h1><p>Administrator access is required.</p></>;
  const { hotel, published } = await userDatabase(identity, async (tx) => ({
    hotel: await tx.hotelDraft.findUnique({ where: { id }, include: { rooms: true, photos: { where: { inDraft: true }, orderBy: { createdAt: "asc" } } } }),
    published: await tx.listing.findUnique({ where: { id }, select: { slug: true, status: true } }),
  }));
  if (!hotel) notFound();
  return <><Link href="/admin/hotels">← Hotel submissions</Link><h1>{hotel.title}</h1><p>Status · {hotel.status.replaceAll("_", " ")} · Revision {hotel.version}</p><p>{hotel.summary}</p><p>{hotel.description}</p><p>{hotel.visitorNote}</p>
    {hotel.contactUrl && <p><a href={hotel.contactUrl}>Hotel contact website</a></p>}
    <HotelOverview amenities={hotel.amenities} rooms={hotel.rooms.filter((r) => !r.archived)} />
    <div className="review-photo-grid">{hotel.photos.map((p) => <Image unoptimized key={p.id} src={`/api/hotel-photos/${p.id}`} width={p.width} height={p.height} alt={`${hotel.title} submitted photo`} sizes="(max-width: 600px) 90vw, 30vw" />)}</div>
    {hotel.status === "pending" ? <HotelReviewForm id={id} version={hotel.version} /> : <>
      {hotel.status === "approved" && published?.status === "published" && <div role="status" className="editor-message"><p>Hotel approved and published.</p><Link href={`/hotels/${published.slug}`}>Open public hotel</Link></div>}
      <p>{hotel.reviewNote || "This hotel is not waiting for review."}</p>
    </>}
  </>;
}
