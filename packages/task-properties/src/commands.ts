import { N2_COMMAND_IDS } from "authz";

/**
 * N8 command rows are counted under N2's 26 (block-entity / entity / property-editor).
 * Enablement stays on authz; this package ships the UI and names the parity set.
 */
export const PROPERTY_COMMAND_IDS = N2_COMMAND_IDS;
export const PROPERTY_COMMAND_COUNT = 26;

/** Surface identities exercised end-to-end by N8 (05-MAP row 6 + property editor). */
export const N8_PARITY_COMMAND_IDS = [
  "block-entity.properties",
  "block-entity.tags",
  "block-entity.priority",
  "block-entity.assignee",
  "block-entity.status",
  "property-editor.close",
  "entity.bulk-move-to-project.down",
  "entity.bulk-move-to-project.up",
  "soup-entity.properties",
  "soup-entity.tags",
  "soup-entity.priority",
  "soup-entity.assignee",
  "soup-entity.status",
] as const;

export type PropertyCommandId = (typeof PROPERTY_COMMAND_IDS)[number];
export type N8ParityCommandId = (typeof N8_PARITY_COMMAND_IDS)[number];
