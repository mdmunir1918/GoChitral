import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { catalogue } from "@/features/catalogue/catalogue";
import { categoryLabels, listingUrl } from "@/features/catalogue/types";
import { readHotelOverview } from "@/features/catalogue/database";
import { HotelOverview } from "@/features/hotels/overview";
import { session, userDatabase } from "@/lib/auth/session";
import { GuideRequestForm } from "./guide-request-form";
import { MapDrawer } from "@/features/maps/map-drawer";
import "./detail.css";

type Props = PageProps<"/[category]/[slug]">;

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, slug } = await params;
  const detail = await catalogue.detail(category, slug);
  if (!detail) notFound();
  return { title: detail.item.title, description: detail.item.summary };
}

export default async function ListingPage({ params }: Props) {
  const { category, slug } = await params;
  const detail = await catalogue.detail(category, slug);
  if (!detail) notFound();
  const { item, related } = detail;
  const photo = item.photo;
  const hotel = item.category === "hotels" ? await readHotelOverview(item.id) : null;
  const identity = item.category === "guides" ? await session() : null;
  const trips = identity?.account.role === "tourist" ? await userDatabase(identity, tx => tx.trip.findMany({ orderBy: { updatedAt: "desc" }, take: 50,
    select: { id: true, title: true, startDate: true, endDate: true } })) : [];
  const reviewed = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(new Date(item.reviewed));
  return (
    <article className="frame listing-page">
      <Link className="text-link" href="/explore">← Back to Explore</Link>
      <div className="detail-layout">
        <header>
          <p className="listing-location">{categoryLabels[item.category]} · {item.location}</p>
          <h1>{item.title}</h1>
          <p className="detail-intro">{item.summary}</p>
          <p><Link className="browse-link" href={`/plan?add=${encodeURIComponent(item.id)}`}>Add to trip →</Link></p>
          <MapDrawer label="Open map and route notes" stops={[{ id: item.id, title: item.title, location: item.location,
            latitude: item.latitude, longitude: item.longitude, visitorNote: item.visitorNote, reviewed: item.reviewed }]} />
          {(item.category === "activities" || item.category === "guides") && <p>{item.servicePriceMinor == null ? "Price unknown" : item.servicePriceMinor === 0 ? "Free" : `PKR ${new Intl.NumberFormat("en-PK", { minimumFractionDigits: 2 }).format(item.servicePriceMinor / 100)}`} · {item.category === "activities" ? "per person" : "per group per day · estimated"}</p>}
          {item.category === "guides" && item.guideProfile && <section className="guide-profile" aria-label="Guide profile">
            <h2>Guide profile</h2><p><strong>Languages</strong> · {item.guideProfile.languages.join(", ")}</p>
            <p><strong>Expertise</strong> · {item.guideProfile.expertise.join(", ")}</p><p><strong>Areas served</strong> · {item.guideProfile.areasServed.join(", ")}</p>
            <p><strong>Credentials</strong> · {item.guideProfile.credentialSummary}</p>
            <p><strong>Pricing unit</strong> · per group per service day</p>
          </section>}
          {item.category === "guides" && (identity?.account.role === "tourist"
            ? item.guideProfile ? <GuideRequestForm guideId={item.id} trips={trips.map(trip => ({ id: trip.id, title: trip.title, start: trip.startDate.toISOString().slice(0,10), end: trip.endDate.toISOString().slice(0,10) }))} /> : <p>Requests are not open for this guide yet.</p>
            : identity ? <p>Use a tourist account to request a guide.</p>
              : <p><Link className="browse-link" href={`/account/sign-in?next=${encodeURIComponent(`/guides/${item.slug}`)}`}>Sign in as a tourist to request this guide →</Link></p>)}
        </header>
        <figure>
          <Image src={photo.src} width={photo.width} height={photo.height} alt={photo.alt}
            unoptimized={photo.license === "owner"}
            sizes="(max-width: 768px) 90vw, 47vw" preload />
          <figcaption>
            <span>{photo.caption}</span>
            {photo.license === "owner" ? <span className="credit">Photo supplied by {photo.author}</span> : <span className="credit"><a href={photo.original}>{photo.author}</a> · <a href={`https://creativecommons.org/licenses/by-sa/${photo.license}/`}>CC BY-SA {photo.license}</a></span>}
          </figcaption>
        </figure>
        <div className="visitor-details">
          <h2>About {item.title}</h2>
          <p>{item.description}</p>
          <h2>Visitor notes</h2>
          <p>{item.visitorNote}</p>
          {item.contactUrl && <p><a className="text-link" href={item.contactUrl}>Public contact website</a></p>}
          {item.latitude !== undefined && item.longitude !== undefined && <p>Coordinates · {item.latitude}, {item.longitude}</p>}
          <p className="source-note">Development listing · Reviewed <time dateTime={item.reviewed}>{reviewed}</time>
            {item.source && <><br /><a className="text-link" href={item.source.url}>{item.source.title}</a></>}
          </p>
        </div>
      </div>
      {hotel && <><HotelOverview amenities={hotel.amenities} rooms={hotel.rooms} />
        {hotel.photos.length > 1 && <section><h2>Hotel photos</h2><div className="public-hotel-photos">{hotel.photos.slice(1).map((p) => <Image unoptimized key={p.id} src={`/api/hotel-photos/${p.id}`} width={p.width} height={p.height} alt={`${item.title} photo`} sizes="(max-width: 768px) 90vw, 30vw" />)}</div></section>}
      </>}
      {related.length > 0 && <section className="related-listings">
        <h2>More in {item.location}</h2>
        <ul>{related.map((record) => <li key={record.id}>
          <Link href={listingUrl(record)}>{record.title} <span aria-hidden="true">→</span></Link>
          <span className="listing-location">{categoryLabels[record.category]}</span>
        </li>)}</ul>
      </section>}
    </article>
  );
}
