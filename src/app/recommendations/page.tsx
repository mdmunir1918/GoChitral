import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { readPublishedListings } from "@/features/catalogue/database";
import { categoryLabels, listingUrl } from "@/features/catalogue/types";
import { interests, rankListings, type Interest } from "@/features/recommendations/rank";

export const metadata = { title: "Suggestions for your Chitral trip" };
export const dynamic = "force-dynamic";
const interestLabels: Record<Interest, string> = { culture: "Culture", hiking: "Hiking and walks", nature: "Nature", history: "History", family: "Family", food: "Food and markets", photography: "Photography", wildlife: "Wildlife" };
type Params = { destination?: string | string[]; interest?: string | string[]; budget?: string | string[] };
function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? "" : value ?? ""; }

export default async function Recommendations({ searchParams }: PageProps<"/recommendations">) {
  const [params, catalogue] = await Promise.all([searchParams as Promise<Params>, readPublishedListings()]);
  const destination = first(params.destination);
  const selectedInterests = (Array.isArray(params.interest) ? params.interest : params.interest ? [params.interest] : [])
    .filter((value): value is Interest => interests.includes(value as Interest));
  const budgetInput = first(params.budget).trim();
  if (budgetInput && !/^\d{1,8}(\.\d{1,2})?$/.test(budgetInput)) notFound();
  const priceTargetMinor = budgetInput ? Math.round(Number(budgetInput) * 100) : undefined;
  const destinations = catalogue.filter((item) => item.category === "destinations");
  const chosen = destinations.some((item) => item.id === destination) ? destination : "";
  const suggestions = rankListings(catalogue, { destinationId: chosen || undefined, interests: selectedInterests, priceTargetMinor }).slice(0, 12);

  return <section className="frame recommendation-page">
    <p className="listing-location">Your preferences stay in this page</p><h1>Find the right places for your trip.</h1>
    <p>Suggestions use published listings and a clear score. They do not book anything. Availability, access and unlisted prices must be confirmed with each provider.</p>
    <form className="recommendation-filters" action="/recommendations" method="get">
      <label>Destination <select name="destination" defaultValue={chosen}><option value="">Any destination</option>{destinations.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <fieldset><legend>What do you enjoy?</legend><div className="recommendation-interest-grid">{interests.map((interest) => <label key={interest}><input type="checkbox" name="interest" value={interest} defaultChecked={selectedInterests.includes(interest)} />{interestLabels[interest]}</label>)}</div></fieldset>
      <label>Price target per room / service (PKR, optional) <input name="budget" inputMode="decimal" maxLength={11} pattern="\d{1,8}(\.\d{1,2})?" defaultValue={budgetInput} placeholder="For example, 5000" /></label>
      <div className="recommendation-actions"><button type="submit">Show suggestions</button><Link className="text-link" href="/recommendations">Clear preferences</Link></div>
    </form>
    <h2>{suggestions.length ? "Suggested places" : "No matching places yet"}</h2>
    <p>Weights: interests 50%, price fit 30%, distance 20%. If a value is missing, its weight is shared across the values available.</p>
    {!suggestions.length && <p>There are no published options for that destination yet. Choose another destination or <Link href="/explore">browse the catalogue</Link>.</p>}
    <div className="recommendation-list">{suggestions.map(({ listing, score, reasons, missingSignals }) => <article key={listing.id}>
      <Image src={listing.photo.src} alt={listing.photo.alt} width={listing.photo.width} height={listing.photo.height} unoptimized={listing.photo.license === "owner"} sizes="(max-width: 640px) 90vw, 24rem" />
      <div><p className="listing-location">{categoryLabels[listing.category]} · {listing.location}</p><h3><Link href={listingUrl(listing)}>{listing.title}</Link></h3><p>{listing.summary}</p>
        <p><strong>{score === null ? "Catalogue order" : `Match score ${Math.round(score * 100)} / 100`}</strong></p>
        {reasons.length > 0 && <ul>{reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
        {missingSignals.length > 0 && <details><summary>What was missing?</summary><ul>{missingSignals.map((signal) => <li key={signal}>{signal}</li>)}</ul></details>}
        <Link className="text-link" href={`/plan?add=${encodeURIComponent(listing.id)}`}>Add to trip →</Link>
      </div>
    </article>)}</div>
  </section>;
}
