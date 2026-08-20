export { TaskProperties, actorContext, requestContext } from "./slice.js";
export type { PropertiesApi } from "./slice.js";
export { dryRunIdentityMapping, mapLegacyPropertyId, PROPERTY_TABLES } from "./mapping.js";
export type { LegacyPropertyRef, IdentityMappingResult, LegacyPropertyTable } from "./mapping.js";
export { PROPERTY_COMMAND_IDS, PROPERTY_COMMAND_COUNT, N8_PARITY_COMMAND_IDS } from "./commands.js";
export type { PropertyCommandId, N8ParityCommandId } from "./commands.js";
export {
  PROPERTY_DATA_TYPES,
} from "./types.js";
export type {
  PropertyDataType,
  PropertyValue,
  PropertyDefinition,
  PropertyOption,
  EntityPropertyRow,
  TagRecord,
  BulkSetValuesInput,
  BulkSetOptionsInput,
  BulkResult,
  BulkItemResult,
  GridRow,
  KanbanColumn,
  CreateDefinitionInput,
} from "./types.js";
export {
  SYSTEM_DEFINITION_IDS,
  SYSTEM_KEY_COUNT,
  TAGS_DEFINITION_ID,
  STATUS_OPTION_IDS,
  PRIORITY_OPTION_IDS,
  KANBAN_NONE,
} from "./system.js";
export { resolveStorageType, accessTypeForStorage } from "./facet.js";
export { PropertyValueIndex, selectOptionId, optionIdsOf } from "./index-store.js";
export { TaskGrid, KanbanBoard, PropertyEditor, TaskPropertiesWorkspace, cellText } from "./ui.js";
