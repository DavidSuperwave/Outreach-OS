import type { TaskAuthenticatedApi, TaskDomainPublicApi, TaskSessionApi } from "./domain-api.js";
import { loadTaskSurface, submitTaskCompose } from "./in-process-session.js";

/** Same key workshop-frontend writes after PublicApi.login / createAccount. */
export const KERNEL_AUTH_TOKEN_KEY = "authToken";

/** Wrapper tenant id for TaskDomainApi.openTenant (OD-24 outreach-* key). */
export const TASK_TENANT_STORAGE_KEY = "outreach-tenant";

/** Origin compositor mounts. Kernel PublicApi is unpatched on /api. */
export const ORIGIN_MOUNTS = {
  kernelApi: "/api",
  domainApi: "/domain",
  subscribe: "/subscribe",
} as const;

export interface KernelPasswordPublicApi {
  login(username: string, passwordHash: Uint8Array): Promise<string | null>;
  createAccount(
    username: string,
    displayName: string,
    passwordHash: Uint8Array,
  ): Promise<string | null>;
}

/** Browser/client boot: kernel session token → TaskSessionApi. Actor never leaves the server. */
export async function bootLiveTaskSession(
  domain: TaskDomainPublicApi,
  token: string,
  tenantId: string,
): Promise<TaskSessionApi> {
  if (!token) throw new Error("session required");
  if (!tenantId) throw new Error("tenantId required");
  const authed: TaskAuthenticatedApi = await domain.authenticate(token);
  return authed.openTenant(tenantId);
}

export async function loginViaKernelPublicApi(
  publicApi: KernelPasswordPublicApi,
  username: string,
  passwordHash: Uint8Array,
): Promise<string> {
  const token = await publicApi.login(username, passwordHash);
  if (!token) throw new Error("login failed");
  return token;
}

export async function createAccountViaKernelPublicApi(
  publicApi: KernelPasswordPublicApi,
  username: string,
  displayName: string,
  passwordHash: Uint8Array,
): Promise<string> {
  const token = await publicApi.createAccount(username, displayName, passwordHash);
  if (!token) throw new Error("createAccount failed");
  return token;
}

export { loadTaskSurface, submitTaskCompose };
