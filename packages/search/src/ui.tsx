import { Shell } from "shell";
import { N16_PARITY_COMMAND_IDS } from "./commands.js";
import { SEARCH_ENTITY_TYPES, type SearchResult } from "./types.js";

export function SearchQueryInput({ query }: { query: string }) {
  return (
    <form data-scope="search-query" data-command={N16_PARITY_COMMAND_IDS[0]}>
      <label>
        Search
        <input
          type="search"
          name="q"
          defaultValue={query}
          aria-label="Search"
          data-command="soup.search-focus"
        />
      </label>
      <button type="submit" data-command="soup.ask-ai" disabled={query.trim().length === 0}>
        Ask AI
      </button>
    </form>
  );
}

export function SearchTypeFilter() {
  return (
    <nav data-surface="search.types" data-command="soup.filter-by-type" aria-label="Search types">
      {SEARCH_ENTITY_TYPES.map((type) => (
        <span key={type} data-search-type={type}>
          {type}
        </span>
      ))}
    </nav>
  );
}

export function SearchHitList({ hits }: { hits: readonly SearchResult[] }) {
  return (
    <ul data-surface="search.results" role="list">
      {hits.map((hit) => (
        <li
          key={hit.entityId}
          data-entity-id={hit.entityId}
          data-entity-type={hit.entityType}
          data-score={String(hit.score)}
        >
          <strong>{hit.title}</strong>
          {hit.snippet ? <p>{hit.snippet}</p> : null}
        </li>
      ))}
    </ul>
  );
}

export function SearchWorkspace({
  query,
  hits,
}: {
  query: string;
  hits: readonly SearchResult[];
}) {
  return (
    <div data-slice="search">
      <Shell path="/search" panes={[{ type: "search", id: "_" }]} theme="outreach-dark" />
      <SearchQueryInput query={query} />
      <SearchTypeFilter />
      <SearchHitList hits={hits} />
    </div>
  );
}
