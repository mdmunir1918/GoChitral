import Link from "next/link";
import { requireRole, userDatabase } from "@/lib/auth/session";
export const metadata = { title: "Your hotels" };
export default async function Hotels() {
  const identity = await requireRole("manager", "/manager/hotels");
  if (!identity) return <><h1>Access denied</h1><p>A hotel manager account is required.</p></>;
  const hotels = await userDatabase(identity, (tx) => tx.hotelDraft.findMany({ where: { ownerId: identity.user.id }, orderBy: { updatedAt: "desc" }, take: 50, select: { id: true, title: true, status: true, reviewNote: true } }));
  return <><h1>Your hotel workspace</h1><p>Create a hotel, add rooms and photos, then submit it for admin review.</p>
    <p className="manager-links"><Link href="/manager/hotels/new">Create a hotel</Link><Link href="/account">Your account</Link></p>
    {!hotels.length && <div className="hotel-empty"><h2>No hotels yet</h2><p>Start with your hotel name and destination. You can save a draft and finish it later.</p></div>}
    <div className="hotel-list">{hotels.map((hotel) => <article key={hotel.id}><h2><Link href={`/manager/hotels/${hotel.id}`}>{hotel.title}</Link></h2><p>Status · {hotel.status.replaceAll("_", " ")}</p>{hotel.reviewNote && <p>Admin note · {hotel.reviewNote}</p>}</article>)}</div>
  </>;
}
