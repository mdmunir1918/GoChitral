import Link from "next/link";
import { dateLabel, money } from "@/features/planner/model";
import type { SavedTrip } from "./read";

export function TripSummary({ saved }: { saved: SavedTrip }) {
  const { trip, available } = saved;
  const unavailable = trip.days.some(day => day.items.some(item => !available.has(item.id)));
  return <><header className="trip-header"><p className="listing-location">Saved itinerary · Revision {trip.revision}</p><h1>{trip.title}</h1>
    <p>{dateLabel(trip.startDate.toISOString().slice(0,10))} – {dateLabel(trip.endDate.toISOString().slice(0,10))} · {trip.people} people</p>
    <p>Destinations · {trip.destinationTitles.join(", ")}</p>
    <p className="trip-note">Saved prices from {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" }).format(trip.updatedAt)} (Asia/Karachi). These are estimates, not bookings. Editing and reviewing refreshes prices.</p>
  </header>
  {unavailable && <p className="trip-notice">Some saved choices are no longer available. Their titles and saved estimates are kept below. <Link className="text-link trip-actions-inline" href={`/my-trips/${trip.id}/edit`}>Edit itinerary to choose replacements</Link>.</p>}
  {trip.guideRequests.length > 0 && <section aria-labelledby="guide-requests-title"><h2 id="guide-requests-title">Guide requests</h2><ul>{trip.guideRequests.map(request => <li key={request.id}>
    <Link className="text-link" href={`/my-trips/requests/${request.reference}`}>{request.guideTitle} · {request.reference}</Link> · {request.status} · {dateLabel(request.startDate.toISOString().slice(0,10))} – {dateLabel(request.endDate.toISOString().slice(0,10))}
  </li>)}</ul></section>}
  <div className="trip-days">{trip.days.map((day, index) => <section className="trip-day" key={day.id}><h2>Day {index + 1} · {dateLabel(day.date.toISOString().slice(0,10))}</h2>
    {!day.items.length && <p>No items selected.</p>}
    {day.items.map(item => <article className="trip-item" key={item.id}><h3>{item.title}</h3>
      {!available.has(item.id) && <p className="trip-unavailable">Unavailable · choose a replacement before travelling.</p>}
      <p>{item.unitMinor === null ? "Price unknown" : item.unitMinor === 0 ? "Free" : money(item.unitMinor)} · {item.unit}</p>
      <p>{item.quantity} {item.category === "hotels" ? `room(s) × ${item.nights} night(s)` : item.category === "activities" ? "participant(s)" : "group / visit"} · {item.totalMinor === null ? "Not included in known subtotal" : money(Number(item.totalMinor))}</p>
      {item.category === "guides" && <p>Guide request: Not requested · estimated fee only.</p>}
    </article>)}
  </section>)}</div>
  <section className="trip-total"><h2>Saved known subtotal · {money(Number(trip.knownTotalMinor))}</h2><p>{trip.unknownCount} {trip.unknownCount === 1 ? "cost is unknown" : "costs are unknown"}. Unknown costs are excluded and are not counted as free.</p>
    {trip.budgetMinor !== null && <p>Budget · {money(Number(trip.budgetMinor))}{trip.knownTotalMinor > trip.budgetMinor ? ` · Known costs exceed it by ${money(Number(trip.knownTotalMinor - trip.budgetMinor))}.` : "."}</p>}
    <p>Only selected nights and services are included. Transport, meals and other unlisted costs are excluded. Confirm provider prices and availability.</p>
  </section></>;
}
