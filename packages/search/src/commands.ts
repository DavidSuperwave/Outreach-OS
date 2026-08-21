/**
 * N16 adds no soup command rows (N4 froze 59). Search chrome reuses the
 * three N4 rows that enable when view === "search".
 */
export const SEARCH_COMMAND_IDS = [] as const;
export type SearchCommandId = (typeof SEARCH_COMMAND_IDS)[number];

export const N16_PARITY_COMMAND_IDS = ["soup.search-focus", "soup.ask-ai", "soup.filter-by-type"] as const;
export type N16ParityCommandId = (typeof N16_PARITY_COMMAND_IDS)[number];
