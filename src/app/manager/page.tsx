import Link from "next/link";
import { requireRole, userDatabase } from "@/lib/auth/session";
import "../account/account.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Hotel manager workspace" };
export default async function Manager({ searchParams }: PageProps<"/manager">) {
  const identity = await requireRole("manager", "/manager");
  if (!identity) return <section className="frame account-page"><h1>Access denied</h1><p>This workspace requires a hotel manager account.</p></section>;
  const { id } = await searchParams;
  const hotelId = typeof id === "string" ? id.slice(0, 100) : undefined;
  const listings = await userDatabase(identity, (tx) => tx.hotelOwnership.findMany({
    where: { ownerId: identity.user.id, ...(hotelId ? { hotelId } : {}) },
    select: { hotel: { select: { id: true, title: true, status: true } } },
  }));
  return <section className="frame account-page">
    <h1>Your hotel workspace</h1>
    <p><Link className="text-link" href="/manager/hotels">Manage hotels, rooms and photos →</Link></p>
    {listings.length ? <ul>{listings.map(({ hotel }) => <li key={hotel.id}>{hotel.title} · {hotel.status}</li>)}</ul> : <p>No hotel listings to show.</p>}
    <Link className="text-link" href="/account">Your account</Link>
  </section>;
}
