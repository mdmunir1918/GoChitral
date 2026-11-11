import Link from "next/link";
import { requireAccount, userDatabase } from "@/lib/auth/session";
import { dateLabel, money } from "@/features/planner/model";

export default async function MyTrips() {
  const identity = await requireAccount("/my-trips");
  const { trips, requests } = await userDatabase(identity, async tx => ({
    trips: await tx.trip.findMany({ orderBy: { updatedAt: "desc" }, take: 50 }),
    requests: await tx.guideRequest.findMany({ where: { ownerId: identity.user.id }, orderBy: { createdAt: "desc" }, take: 50, include: { guide: { select: { title: true } }, trip: { select: { title: true } } } }),
  }));
  return <><h1>My trips</h1><p>Your saved itineraries and estimates.</p><p className="trip-actions"><Link className="browse-link" href="/plan">Plan a new trip →</Link></p>
    {!trips.length ? <div className="trip-empty"><h2>No trips saved yet</h2><p>Choose your places and days, then save your itinerary.</p><Link className="text-link" href="/plan">Plan your first trip</Link></div> : <>
      <p>Showing your {trips.length === 50 ? "50 most recently updated trips" : `${trips.length} saved ${trips.length === 1 ? "trip" : "trips"}`}.</p>
      <div className="trip-list">{trips.map(trip => <article key={trip.id}><h2><Link href={`/my-trips/${trip.id}`}>{trip.title}</Link></h2><p>{dateLabel(trip.startDate.toISOString().slice(0,10))} – {dateLabel(trip.endDate.toISOString().slice(0,10))} · {trip.people} people</p><p>Saved known subtotal · {money(Number(trip.knownTotalMinor))} · {trip.unknownCount} unknown costs</p><Link className="text-link" href={`/my-trips/${trip.id}`}>Open itinerary</Link></article>)}</div>
    </>}
    <section aria-labelledby="my-guide-requests"><h2 id="my-guide-requests">Guide requests</h2>
      {!requests.length && <p>No guide requests yet.</p>}
      <ul>{requests.map(request => <li key={request.id}><Link className="text-link" href={`/my-trips/requests/${request.reference}`}>{request.guideTitle} · {request.reference}</Link> · {request.status} · {request.trip.title}</li>)}</ul>
    </section>
  </>;
}
