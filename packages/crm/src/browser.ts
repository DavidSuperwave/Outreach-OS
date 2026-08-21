// Browser-safe exports for UI fixtures
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
export { CRM_COMMAND_IDS, CRM_COMMAND_FREEZE_COUNT, N12_PARITY_COMMAND_IDS } from "./commands.js";
export type { CrmCommandId, N12ParityCommandId } from "./commands.js";
export { COMPANY_PROPERTY_IDS, STAGE_OPTION_IDS, STAGE_OPTIONS, KANBAN_NONE } from "./types.js";
export type {
  CompanyRecord,
  ContactRecord,
  CompanyView,
  CompanyProperties,
  CompanyKanbanColumn,
  EmailLinkSlot,
  ActivitySlot,
} from "./types.js";
