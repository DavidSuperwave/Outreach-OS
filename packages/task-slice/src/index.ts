export { TaskSlice, actorContext, requestContext } from "./slice.js";
export type { TaskApi, TaskRecord, TaskRpc, TaskSliceSnapshot, TaskView } from "./slice.js";
export { classifyOutreachPath, KERNEL_PUBLIC_API_PATH, TASK_DOMAIN_API_PATH } from "./routes.js";
export type { TaskAuthenticatedApi, TaskDomainPublicApi, TaskSessionApi } from "./domain-api.js";
export { dryRunIdentityMapping, mapLegacyTaskId } from "./mapping.js";
export type { LegacyTaskRef, IdentityMappingResult } from "./mapping.js";
export { SLICE_COMMAND_IDS, runSliceCommand, bindSliceCommands } from "./commands.js";
export type { SliceCommandId, SliceCommandInput, SliceCommandResult } from "./commands.js";
export { TaskComposePopover, TaskList, TaskWorkspace } from "./ui.js";
export { inProcessTaskSession, loadTaskSurface, submitTaskCompose } from "./in-process-session.js";
export {
  bootLiveTaskSession,
  createAccountViaKernelPublicApi,
  loginViaKernelPublicApi,
  KERNEL_AUTH_TOKEN_KEY,
  ORIGIN_MOUNTS,
  TASK_TENANT_STORAGE_KEY,
  outreachBootConfig,
} from "./live-session.js";
export type { KernelPasswordPublicApi, OutreachBootConfig } from "./live-session.js";
export { renderOutreachDocument } from "./origin-html.js";
export type { OperatorAlert } from "./operator-alerts.js";
