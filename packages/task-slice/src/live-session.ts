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

export function taskSubscribeUrl(
  subscribePath: string,
  cursor: number,
  token: string,
  tenant: string,
): string {
  const sep = subscribePath.includes("?") ? "&" : "?";
  return `${subscribePath}${sep}cursor=${cursor}&token=${encodeURIComponent(token)}&tenant=${encodeURIComponent(tenant)}`;
}

export interface TaskSubscribeSocket {
  addEventListener(type: "message" | "close" | "error", listener: (event: { data?: unknown }) => void): void;
  close(): void;
}

/**
 * Browser /subscribe: replay from cursor on drop, then reopen. Query token is
 * required because a browser WebSocket cannot set Authorization.
 */
export function attachTaskSubscribe(opts: {
  open: (url: string) => TaskSubscribeSocket;
  subscribePath: string;
  token: string;
  tenant: string;
  session: Pick<TaskSessionApi, "seq" | "replayFrom">;
  onDelta: () => void;
  onError?: (error: unknown) => void;
}): { close(): void } {
  let closed = false;
  let socket: TaskSubscribeSocket | undefined;
  let cursor = 0;
  let reconnecting = false;

  const connect = async () => {
    if (closed) return;
    try {
      cursor = await opts.session.seq();
    } catch (error) {
      opts.onError?.(error);
      return;
    }
    if (closed) return;
    socket = opts.open(taskSubscribeUrl(opts.subscribePath, cursor, opts.token, opts.tenant));
    socket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(String(event.data)) as { seq?: number };
        if (typeof payload.seq === "number") cursor = payload.seq;
      } catch {
        // non-JSON frames are still a live ping — refresh the Soup surface
      }
      opts.onDelta();
    });
    const reattach = () => {
      if (closed || reconnecting) return;
      reconnecting = true;
      void (async () => {
        try {
          const missed = await opts.session.replayFrom(cursor);
          if (missed.length) opts.onDelta();
          cursor = await opts.session.seq();
        } catch (error) {
          opts.onError?.(error);
        } finally {
          reconnecting = false;
          if (!closed) await connect();
        }
      })();
    };
    socket.addEventListener("close", reattach);
    socket.addEventListener("error", reattach);
  };

  void connect();
  return {
    close() {
      closed = true;
      socket?.close();
    },
  };
}
