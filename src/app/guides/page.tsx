import Image from "next/image";
import Link from "next/link";
import { readPublishedListings } from "@/features/catalogue/database";
import type { Listing } from "@/features/catalogue/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Find a guide" };

export default async function Guides() {
  const items = (await readPublishedListings()).filter((guide): guide is Extract<Listing, { category: "guides" }> => guide.category === "guides" && Boolean(guide.guideProfile));
  return <section className="frame explore-page"><h1>Find a guide</h1>
    <p>Review languages, expertise, areas served and pricing before requesting service dates. A request is not a confirmed booking.</p>
    <div className="listing-grid">{items.map(guide => <article className="listing-card" key={guide.id}>
      <Image src={guide.photo.src} alt={guide.photo.alt} width={guide.photo.width} height={guide.photo.height} unoptimized={guide.photo.license === "owner"} sizes="(max-width: 640px) 90vw, 29vw" />
      <p className="listing-location">{guide.location}</p><h2><Link href={`/guides/${guide.slug}`}>{guide.title}</Link></h2><p>{guide.summary}</p>
      {guide.guideProfile && <><p>Languages · {guide.guideProfile.languages.join(", ")}</p><p>Areas served · {guide.guideProfile.areasServed.join(", ")}</p></>}
      <Link className="text-link" href={`/guides/${guide.slug}`}>View profile and request →</Link>
    </article>)}</div>
    {!items.length && <p>No published guide profiles are available yet.</p>}
  </section>;
}
