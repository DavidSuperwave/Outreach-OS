/** Access lattice from entity_access extractors: View < Comment < Edit < Owner. */
export const ACCESS_LEVELS = ["view", "comment", "edit", "owner"] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export const LEVEL_RANK: Record<AccessLevel, number> = {
  view: 1,
  comment: 2,
  edit: 3,
  owner: 4,
};

export function levelSatisfies(have: AccessLevel, need: AccessLevel): boolean {
  return LEVEL_RANK[have] >= LEVEL_RANK[need];
}
