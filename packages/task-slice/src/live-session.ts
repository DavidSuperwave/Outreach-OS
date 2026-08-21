import type { TaskAuthenticatedApi, TaskDomainPublicApi, TaskSessionApi } from "./domain-api.js";

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

export interface OutreachBootConfig {
  kernelApi: typeof ORIGIN_MOUNTS.kernelApi;
  domainApi: typeof ORIGIN_MOUNTS.domainApi;
  subscribe: typeof ORIGIN_MOUNTS.subscribe;
  authTokenKey: typeof KERNEL_AUTH_TOKEN_KEY;
  tenantKey: typeof TASK_TENANT_STORAGE_KEY;
  path: string;
}

export function outreachBootConfig(path: string): OutreachBootConfig {
  return {
    ...ORIGIN_MOUNTS,
    authTokenKey: KERNEL_AUTH_TOKEN_KEY,
    tenantKey: TASK_TENANT_STORAGE_KEY,
    path,
  };
}

export interface KernelPasswordPublicApi {
  login(username: string, passwordHash: Uint8Array): Promise<string | null>;
  createAccount(
    username: string,
    displayName: string,
    passwordHash: Uint8Array,
  ): Promise<string | null>;
}

/**
 * Cap'n Web reaps a child stub when its parent capability is dropped. The browser
 * hydrate must keep `authenticate()`'s return value alive for as long as the session.
 */
const capnpParents = new WeakMap<object, object>();

function pinCapnpParent<T>(child: T, parent: object): T {
  if (child && typeof child === "object") capnpParents.set(child, parent);
  return child;
}

/** Browser/client boot: kernel session token → TaskSessionApi. Actor never leaves the server. */
export async function bootLiveTaskSession(
  domain: TaskDomainPublicApi,
  token: string,
  tenantId?: string,
): Promise<TaskSessionApi> {
  if (!token) throw new Error("session required");
  const authed: TaskAuthenticatedApi = await domain.authenticate(token);
  const session = tenantId ? await authed.openTenant(tenantId) : await authed.openDefaultTenant();
  return pinCapnpParent(session, authed);
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

export async function loadTaskSurface(session: TaskSessionApi): Promise<{
  items: Awaited<ReturnType<TaskSessionApi["listTasks"]>>;
  activity: Array<{ id: string; action: string; entityId: string }>;
  alerts: Awaited<ReturnType<TaskSessionApi["listAlerts"]>>;
}> {
  const [items, facts, alerts] = await Promise.all([
    session.listTasks(),
    session.listActivity(),
    session.listAlerts(),
  ]);
  return {
    items,
    activity: facts.map((fact) => ({
      id: fact.id,
      action: fact.action,
      entityId: fact.entityId,
    })),
    alerts,
  };
}

/** Compose popover submit — the same mutation `c` then `t` invokes. */
export async function submitTaskCompose(
  session: TaskSessionApi,
  title: string,
  correlationId?: string,
): Promise<Awaited<ReturnType<typeof loadTaskSurface>>> {
  await session.createTask(title, correlationId);
  return loadTaskSurface(session);
}
