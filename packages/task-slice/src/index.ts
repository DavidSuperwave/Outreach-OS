export { TaskSlice, actorContext, requestContext } from "./slice.js";
export type { TaskApi, TaskRecord, TaskRpc, TaskSliceSnapshot, TaskView } from "./slice.js";
export { dryRunIdentityMapping, mapLegacyTaskId } from "./mapping.js";
export type { LegacyTaskRef, IdentityMappingResult } from "./mapping.js";
export { SLICE_COMMAND_IDS, runSliceCommand, bindSliceCommands } from "./commands.js";
export type { SliceCommandId, SliceCommandInput, SliceCommandResult } from "./commands.js";
export { TaskComposePopover, TaskList, TaskWorkspace } from "./ui.js";
