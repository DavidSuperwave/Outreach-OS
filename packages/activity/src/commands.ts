/**
 * N17 has 0 new command rows (05-GRAPH §N17). Favorites chrome already
 * froze on N4 (`favorites.open.<favorite>`, `soup-entity.favorite`).
 * Recents go-to lives on N5. Visible recents IS frecency.
 */
export const ACTIVITY_COMMAND_IDS = [] as const;
export type ActivityCommandId = (typeof ACTIVITY_COMMAND_IDS)[number];

export const N17_PARITY_COMMAND_IDS = ["favorites.open.<favorite>", "soup-entity.favorite"] as const;
export type N17ParityCommandId = (typeof N17_PARITY_COMMAND_IDS)[number];
