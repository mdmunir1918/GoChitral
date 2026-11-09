import type { ReactNode } from "react";

export function PlaceSearch({ query = "", children }: { query?: string; children?: ReactNode }) {
  return (
    <form className="place-search" action="/explore" method="get" role="search">
      <label htmlFor="place-query">Search the travel guide</label>
      <div className="search-row">
        <span className="search-icon" aria-hidden="true" />
        <input id="place-query" name="q" type="search" maxLength={100} defaultValue={query} placeholder="Enter a place or valley" />
        {!children && <button type="submit">Search</button>}
      </div>
      {children && <div className="catalogue-controls">{children}<button type="submit">Apply filters</button></div>}
    </form>
  );
}
