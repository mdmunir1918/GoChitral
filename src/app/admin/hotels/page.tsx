import Link from "next/link";
import { requireRole, userDatabase } from "@/lib/auth/session";
export const metadata = { title: "Hotel submissions" };
export default async function HotelSubmissions() {
  const identity = await requireRole("administrator", "/admin/hotels");
  if (!identity) return <><h1>Access denied</h1><p>Administrator access is required.</p></>;
  const hotels = await userDatabase(identity, (tx) => tx.hotelDraft.findMany({ where: { status: "pending" }, orderBy: { updatedAt: "asc" }, take: 50, select: { id: true, title: true, version: true } }));
  return <><Link href="/admin">← Publishing workspace</Link><h1>Hotel submissions</h1><p>Review the hotel, rooms and photos before publishing.</p>
    {!hotels.length && <p>No hotels waiting for review.</p>}<div className="moderation-list">{hotels.map((h) => <article key={h.id}><h2><Link href={`/admin/hotels/${h.id}`}>{h.title}</Link></h2><p>Revision {h.version}</p></article>)}</div>
  </>;
}
