// Browser-safe exports for UI fixtures
export { TaskComposePopover, TaskList, TaskWorkspace } from "./ui.js";
export { SLICE_COMMAND_IDS } from "./commands.js";
export type { SliceCommandId } from "./commands.js";
export {
  bootLiveTaskSession,
  createAccountViaKernelPublicApi,
  loginViaKernelPublicApi,
  loadTaskSurface,
  submitTaskCompose,
  attachTaskSubscribe,
  taskSubscribeUrl,
  KERNEL_AUTH_TOKEN_KEY,
  ORIGIN_MOUNTS,
  TASK_TENANT_STORAGE_KEY,
} from "./live-session.js";
export type { KernelPasswordPublicApi } from "./live-session.js";
export type { TaskAuthenticatedApi, TaskDomainPublicApi, TaskSessionApi } from "./domain-api.js";
