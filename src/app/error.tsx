"use client";

export default function CatalogueError({ reset }: { reset: () => void }) {
  return (
    <section className="frame explore-page">
      <h1>Guide unavailable</h1>
      <p>We couldn’t load the travel guide. Please try again.</p>
      <button className="browse-link" onClick={reset}>Try again</button>
    </section>
  );
}
