/**
 * Global domain-directory cache (KV stand-in) + enrichment stub.
 * Apollo / unfurl-fallback are Gatekeeper consumers (OD-6); this node never
 * fetches. A `fetcher` argument is accepted so tests can prove it is not invoked.
 */

export type EnrichmentFetcher = (domain: string) => DirectoryEntry;

export interface DirectoryEntry {
  domain: string;
  name: string;
  description: string;
  source: "directory-stub" | "apollo-stub" | "unfurl-stub";
  stage?: string | null;
  revenue?: number | null;
}

export interface EnrichmentPort {
  lookup(domain: string): DirectoryEntry | null;
  put(entry: DirectoryEntry): DirectoryEntry;
  enrich(domain: string, fetcher?: EnrichmentFetcher): DirectoryEntry;
}

export function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]!;
}

export function enrichmentStub(cache = new Map<string, DirectoryEntry>()): EnrichmentPort {
  return {
    lookup(domain) {
      return cache.get(normalizeDomain(domain)) ?? null;
    },
    put(entry) {
      const key = normalizeDomain(entry.domain);
      const stored = { ...entry, domain: key };
      cache.set(key, stored);
      return stored;
    },
    enrich(domain, fetcher) {
      void fetcher;
      const key = normalizeDomain(domain);
      const existing = cache.get(key);
      if (existing) return existing;
      const entry: DirectoryEntry = {
        domain: key,
        name: key,
        description: "",
        source: "directory-stub",
      };
      cache.set(key, entry);
      return entry;
    },
  };
}
