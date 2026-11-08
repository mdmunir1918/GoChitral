export function PlaceSearch({ query = "" }: { query?: string }) {
  return (
    <form className="place-search" action="/explore" method="get" role="search">
      <label htmlFor="place-query">Search the travel guide</label>
      <div className="search-row">
        <span className="search-icon" aria-hidden="true" />
        <input id="place-query" name="q" type="search" maxLength={100} defaultValue={query} placeholder="Enter a place or valley" />
        <button type="submit">Search</button>
      </div>
    </form>
  );
}
