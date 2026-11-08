import type { Metadata } from "next";
import Link from "next/link";
import { PlaceSearch } from "@/components/place-search";

export const metadata: Metadata = { title: "Explore Chitral" };

export default async function Explore({ searchParams }: PageProps<"/explore">) {
  const { q } = await searchParams;
  const value = Array.isArray(q) ? q[0] : q;
  const query = (value ?? "").trim().slice(0, 100);

  return (
    <section className="frame explore-page">
      <h1>Explore <em>Chitral.</em></h1>
      <PlaceSearch key={query} query={query} />
      <div className="catalogue-status">
        <h2>{query ? `Search for “${query}”` : "Place listings"}</h2>
        <p>The first places will appear here as they are added to the guide.</p>
        {query && <Link className="browse-link" href="/explore">Clear search</Link>}
      </div>
    </section>
  );
}
