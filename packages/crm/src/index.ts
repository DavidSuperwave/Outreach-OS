export { CrmSlice, actorContext, requestContext, CrmError } from "./slice.js";
export type { CrmApi, CompanyViewResult, ContactView } from "./slice.js";
export { dryRunIdentityMapping, mapLegacyCrmId, CRM_TABLES } from "./mapping.js";
export type { LegacyCrmRef, IdentityMappingResult, LegacyCrmTable } from "./mapping.js";
export { CRM_COMMAND_IDS, CRM_COMMAND_FREEZE_COUNT, N12_PARITY_COMMAND_IDS } from "./commands.js";
export type { CrmCommandId, N12ParityCommandId } from "./commands.js";
export { enrichmentStub, normalizeDomain } from "./enrichment.js";
export type { EnrichmentPort, EnrichmentFetcher, DirectoryEntry } from "./enrichment.js";
export {
  COMPANY_PROPERTY_IDS,
  STAGE_OPTION_IDS,
  STAGE_OPTIONS,
  KANBAN_NONE,
} from "./types.js";
export type {
  CompanyRecord,
  ContactRecord,
  CompanyView,
  CompanyProperties,
  CompanyKanbanColumn,
  EmailLinkSlot,
  ActivitySlot,
  EmailEvidence,
  CreateCompanyInput,
  CreateContactInput,
} from "./types.js";
export {
  CompanyComposePopover,
  ContactComposePopover,
  CompanyList,
  CompanyKanban,
  CompanyDetail,
  ContactList,
  EmailLinkSlotList,
  ActivitySlotList,
  CompanyWorkspace,
} from "./ui.js";
