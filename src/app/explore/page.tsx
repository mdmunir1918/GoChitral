import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PlaceSearch } from "@/components/place-search";
import { catalogue, pageUrl } from "@/features/catalogue/catalogue";
import { categoryLabels, listingUrl } from "@/features/catalogue/types";
import "./explore.css";

export const metadata: Metadata = { title: "Explore Chitral" };

export default async function Explore({ searchParams }: PageProps<"/explore">) {
  const { filters, locations, items, page, pages, total } = await catalogue.search(await searchParams);
  const filtered = Boolean(filters.q || filters.category || filters.location || filters.sort !== "guide");
  return (
    <section className="frame explore-page">
      <h1>Explore <em>Chitral.</em></h1>
      <p className="catalogue-note">Development catalogue · Sample hotel and guide profiles</p>
      <p><Link className="browse-link" href="/recommendations">Get suggestions based on your interests →</Link></p>
      <PlaceSearch key={pageUrl(filters, 1)} query={filters.q}>
        <div className="filter-fields">
          <div><label htmlFor="category">Category</label>
            <select id="category" name="category" defaultValue={filters.category}>
              <option value="">All categories</option>
              {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div><label htmlFor="location">Location</label>
            <select id="location" name="location" defaultValue={filters.location}>
              <option value="">All locations</option>
              {locations.map((location) => <option key={location}>{location}</option>)}
            </select>
          </div>
          <div><label htmlFor="catalogue-sort">Sort by</label>
            <select id="catalogue-sort" name="sort" defaultValue={filters.sort}>
              <option value="guide">Guide order</option>
              <option value="az">Name, A to Z</option>
              <option value="za">Name, Z to A</option>
            </select>
          </div>
        </div>
      </PlaceSearch>
      <div className="results-heading">
        <h2>{total ? `${total} ${total === 1 ? "listing" : "listings"}` : "No listings found"}{filters.q && ` for “${filters.q}”`}</h2>
        {filtered && <Link className="text-link" href="/explore">Clear filters</Link>}
      </div>
      {!total && <p>Try a different place name or clear the filters to see the full catalogue.</p>}
      <div className="listing-grid">
        {items.map((item) => (
          <article key={item.id} className="listing-card">
            <Image src={item.photo.src} alt={item.photo.alt} width={item.photo.width} height={item.photo.height}
              unoptimized={item.photo.license === "owner"}
              sizes="(max-width: 640px) 90vw, (max-width: 900px) 44vw, 29vw" />
            <p className="listing-location">{categoryLabels[item.category]} · {item.location}</p>
            <h3><Link href={listingUrl(item)}>{item.title}</Link></h3>
            <p>{item.summary}</p>
            {item.category === "hotels" && <p>{item.roomCount ? `${item.roomCount} room types` : "Ask about room types"}{item.fromNightlyMinor !== undefined && ` · From PKR ${new Intl.NumberFormat("en-PK").format(item.fromNightlyMinor / 100)} / night`}</p>}
            <Link className="text-link" href={`/plan?add=${encodeURIComponent(item.id)}`}>Add to trip</Link>
          </article>
        ))}
      </div>
      {pages > 1 && <nav className="page-nav" aria-label="Catalogue pages">
        {page > 1 && <Link className="text-link" href={pageUrl(filters, page - 1)}>← Previous</Link>}
        <span>Page {page} of {pages}</span>
        {page < pages && <Link className="text-link" href={pageUrl(filters, page + 1)}>Next →</Link>}
      </nav>}
    </section>
  );
}
