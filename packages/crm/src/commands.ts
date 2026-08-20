/**
 * N12 CRM command rows are counted inside soup-entity (3 of the 22):
 * company Stage / Owner / Revenue. Chrome `go-to.companies` lives on N5.
 * `block-company` / `block-contact` are pointer-driven UI (parity via fixtures).
 */
export const CRM_COMMAND_FREEZE_COUNT = 3;

export const CRM_COMMAND_IDS = [
  "soup-entity.company-stage",
  "soup-entity.company-owner",
  "soup-entity.company-revenue",
] as const;

export type CrmCommandId = (typeof CRM_COMMAND_IDS)[number];

/** Surface identities exercised end-to-end by N12 (05-MAP row 10 + kanban). */
export const N12_PARITY_COMMAND_IDS = [
  "go-to.companies",
  "soup-entity.company-stage",
  "soup-entity.company-owner",
  "soup-entity.company-revenue",
  "block-company",
  "block-contact",
] as const;

export type N12ParityCommandId = (typeof N12_PARITY_COMMAND_IDS)[number];
