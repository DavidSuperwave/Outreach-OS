import { RpcTarget, newWorkersRpcResponse } from "capnweb";
import { requestContext } from "control-plane";
import {
  bindKernelSession,
  bearerToken,
  DurableTeamsApi,
  parseKernelSessionToken,
  SEED_ADMIN,
  SEED_MEMBER,
  SEED_OUTSIDER,
  SessionBindError,
} from "identity";
import type { ActorContext } from "identity/principal";
import { DurableTaskApi } from "./durable-task-api.js";
import type { TaskAuthenticatedApi, TaskDomainPublicApi, TaskSessionApi } from "./domain-api.js";
import { loadTaskSurface } from "./in-process-session.js";
import { renderOutreachDocument } from "./origin-html.js";
import { classifyOutreachPath } from "./routes.js";
import { localKernelPublicApiFetcher } from "./local-public-api.js";

/** Tests and workers without an ASSETS binding still serve a hydrate marker. */
const OUTREACH_SHELL_STUB =
  "/* LiveOutreach hydrate stub — wrangler ASSETS serves dist/assets/outreach-shell.js */\n";

interface KernelUserDo {
  authenticate(secret: string): Promise<void>;
}

export interface WorkshopFetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface TaskWorkerEnv {
  TASK_SLICE: {
    idFromName(name: string): { toString(): string };
    get(id: { toString(): string }): DurableObjectStubLike;
  };
  SOUP: unknown;
  TEAM?: ConstructorParameters<typeof DurableTeamsApi>[0];
  USER?: {
    idFromName(name: string): { toString(): string };
    get(id: { toString(): string }): KernelUserDo;
  };
  /** Kernel Workshop worker. `/api` is proxied here so PublicApi stays unpatched. */
  WORKSHOP?: WorkshopFetcher;
  /**
   * Local origin only. When "true" and USER is bound, `/api` serves login/createAccount
   * over the kernel User DO. Production binds WORKSHOP instead.
   */
  LOCAL_KERNEL_API?: string;
  /** Wrangler static assets (`dist/assets/outreach-shell.js`). */
  ASSETS?: WorkshopFetcher;
  /** Local/prod Queues producer for outbox re-drive. */
  TASK_OUTBOX?: { send(message: { tenantId: string }): Promise<unknown> };
}

interface DurableObjectStubLike {
  listVisible(actor: ActorContext): Promise<unknown>;
  mintView(
    actor: ActorContext,
    entityId: string,
    need: "view" | "edit" | "owner",
  ): Promise<{ ok: true; receipt: import("authz").Receipt } | { ok: false; message: string }>;
  createTask(title: string, ctx: import("control-plane").RequestContext): Promise<unknown>;
  updateTitle(title: string, ctx: import("control-plane").RequestContext): Promise<unknown>;
  drainOutbox(): Promise<{ pending: number }>;
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

function seedDirectory(teams: DurableTeamsApi): DurableTeamsApi {
  teams.registerKernelUser(SEED_ADMIN);
  teams.registerKernelUser(SEED_MEMBER);
  teams.registerKernelUser(SEED_OUTSIDER);
  return teams;
}

function requireBindings(env: TaskWorkerEnv): {
  teams: DurableTeamsApi;
  authenticate: (username: string, secret: string) => Promise<void>;
} {
  if (!env.USER || !env.TEAM) {
    throw new SessionBindError(401, "session bindings unavailable");
  }
  const teams = seedDirectory(new DurableTeamsApi(env.TEAM, new Set(["admin"])));
  return {
    teams,
    authenticate: (username, secret) => env.USER!.get(env.USER!.idFromName(username)).authenticate(secret),
  };
}

async function assertKernelToken(env: TaskWorkerEnv, token: string): Promise<void> {
  const { teams, authenticate } = requireBindings(env);
  let username: string;
  let secret: string;
  try {
    ({ username, secret } = parseKernelSessionToken(token));
  } catch {
    throw new SessionBindError(401, "invalid kernel session token");
  }
  try {
    await authenticate(username, secret);
  } catch {
    throw new SessionBindError(401, "invalid session");
  }
  if (!teams.users.get(username)) {
    await teams.ensureKernelUser(username);
  }
}

async function actorFromSession(env: TaskWorkerEnv, token: string, tenantId: string): Promise<ActorContext> {
  const { teams, authenticate } = requireBindings(env);
  const { username } = parseKernelSessionToken(token);
  await teams.ensureKernelUser(username);
  return bindKernelSession({
    token,
    tenantId,
    directory: teams,
    authenticate,
    memberRole: async (userId, teamId) => {
      const session = teams.users.get(userId);
      if (!session) return null;
      return teams.resolveEffectiveRole(session, teamId);
    },
  });
}

function rpcError(error: unknown): Error {
  if (error instanceof SessionBindError) return error;
  return error instanceof Error ? error : new Error("rpc failed");
}

export class TaskSessionTarget extends RpcTarget implements TaskSessionApi {
  constructor(
    private readonly env: TaskWorkerEnv,
    private readonly actor: ActorContext,
  ) {
    super();
  }

  #api(): DurableTaskApi {
    const tenantId = this.actor.actor.tenantId;
    if (!tenantId) throw new Error("session is not tenant-scoped");
    return new DurableTaskApi(this.env.TASK_SLICE as never, tenantId);
  }

  #stub() {
    const tenantId = this.actor.actor.tenantId!;
    return this.env.TASK_SLICE.get(this.env.TASK_SLICE.idFromName(tenantId));
  }

  async #mutate<T>(
    entityId: string,
    need: "edit" | "owner",
    correlationId: string | undefined,
    run: (api: DurableTaskApi, ctx: import("control-plane").RequestContext) => Promise<T>,
  ): Promise<T> {
    const minted = await this.#stub().mintView(this.actor, entityId, need);
    if (!minted.ok) throw new Error(minted.message);
    return run(this.#api(), requestContext(this.actor, { receipt: minted.receipt, correlationId }));
  }

  async createTask(title: string, correlationId?: string) {
    if (!title) throw new Error("title required");
    return this.#api().createTask(title, requestContext(this.actor, { correlationId }));
  }

  async listTasks() {
    return this.#api().listVisible(this.actor);
  }

  async listActivity() {
    return this.#api().listActivity(this.actor);
  }

  async listAlerts() {
    return this.#api().listAlerts(this.actor);
  }

  async updateTitle(entityId: string, title: string, correlationId?: string) {
    if (!entityId || !title) throw new Error("entityId and title required");
    return this.#mutate(entityId, "edit", correlationId, (api, ctx) => api.updateTitle(title, ctx));
  }

  async setStatus(entityId: string, status: string, correlationId?: string) {
    return this.#mutate(entityId, "edit", correlationId, (api, ctx) => api.setStatus(status, ctx));
  }

  async setPriority(entityId: string, priority: string, correlationId?: string) {
    return this.#mutate(entityId, "edit", correlationId, (api, ctx) => api.setPriority(priority, ctx));
  }

  async setAssignee(entityId: string, assigneeId: string, correlationId?: string) {
    return this.#mutate(entityId, "edit", correlationId, (api, ctx) => api.setAssignee(assigneeId, ctx));
  }

  async markDone(entityId: string, done: boolean, correlationId?: string) {
    return this.#mutate(entityId, "edit", correlationId, (api, ctx) => api.markDone(done, ctx));
  }

  async seq() {
    return this.#api().seq();
  }

  async replayFrom(seq: number) {
    return this.#api().replayFrom(seq, this.actor);
  }

  async rebuildProjection() {
    return this.#api().rebuildProjection(this.actor);
  }

  async tenantId() {
    const tenantId = this.actor.actor.tenantId;
    if (!tenantId) throw new Error("session is not tenant-scoped");
    return tenantId;
  }
}

export class TaskAuthenticatedTarget extends RpcTarget implements TaskAuthenticatedApi {
  constructor(
    private readonly env: TaskWorkerEnv,
    private readonly token: string,
  ) {
    super();
  }

  async openTenant(tenantId: string): Promise<TaskSessionTarget> {
    if (!tenantId) throw new Error("tenantId required");
    try {
      const actor = await actorFromSession(this.env, this.token, tenantId);
      return new TaskSessionTarget(this.env, actor);
    } catch (error) {
      throw rpcError(error);
    }
  }

  async openDefaultTenant(): Promise<TaskSessionTarget> {
    try {
      const { teams } = requireBindings(this.env);
      const { username } = parseKernelSessionToken(this.token);
      const session = await teams.ensureKernelUser(username);
      const team = await teams.ensureHomeTeam(session);
      return this.openTenant(team.id);
    } catch (error) {
      throw rpcError(error);
    }
  }
}

export class TaskDomainTarget extends RpcTarget implements TaskDomainPublicApi {
  constructor(private readonly env: TaskWorkerEnv) {
    super();
  }

  async authenticate(token: string): Promise<TaskAuthenticatedTarget> {
    if (!token) throw new SessionBindError(401, "session required");
    try {
      await assertKernelToken(this.env, token);
    } catch (error) {
      throw rpcError(error);
    }
    return new TaskAuthenticatedTarget(this.env, token);
  }
}

async function subscribeFromSession(request: Request, env: TaskWorkerEnv): Promise<Response> {
  const url = new URL(request.url);
  const token = bearerToken(request) ?? url.searchParams.get("token");
  const tenantId = request.headers.get("x-neuwave-tenant") ?? url.searchParams.get("tenant");
  if (!token || !tenantId) {
    return new Response("session required", { status: 401 });
  }
  let actor: ActorContext;
  try {
    actor = await actorFromSession(env, token, tenantId);
  } catch (error) {
    if (error instanceof SessionBindError) {
      return new Response(error.message, { status: error.status });
    }
    return new Response(error instanceof Error ? error.message : "session failed", { status: 401 });
  }
  const cursor = Number(url.searchParams.get("cursor") ?? "0");
  return new DurableTaskApi(env.TASK_SLICE as never, tenantId).subscribe(cursor, actor);
}

async function serveOutreachShell(request: Request, env: TaskWorkerEnv): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("method not allowed", { status: 405 });
  }
  const path = new URL(request.url).pathname;
  const token = bearerToken(request);
  const tenantId = request.headers.get("x-neuwave-tenant");
  let username = "signed-out";
  let items: Awaited<ReturnType<typeof loadTaskSurface>>["items"] = [];
  let activity: Awaited<ReturnType<typeof loadTaskSurface>>["activity"] = [];
  let alerts: Awaited<ReturnType<typeof loadTaskSurface>>["alerts"] = [];
  if (token && tenantId) {
    try {
      const actor = await actorFromSession(env, token, tenantId);
      username = actor.kernelUsername;
      const surface = await loadTaskSurface(new TaskSessionTarget(env, actor));
      items = surface.items;
      activity = surface.activity;
      alerts = surface.alerts;
    } catch {
      username = "signed-out";
    }
  }
  const html = renderOutreachDocument({ path, username, items, activity, alerts });
  return new Response(request.method === "HEAD" ? null : html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-outreach-origin": "compositor",
    },
  });
}

/**
 * Outreach origin fetch: custom React shell HTML, kernel PublicApi on `/api`
 * (Workshop service binding, unpatched), wrapper TaskDomainApi Cap'n Web on `/domain`,
 * live subscribe as streaming bytes.
 */
export async function handleOutreachFetch(request: Request, env: TaskWorkerEnv): Promise<Response> {
  const url = new URL(request.url);
  const kind = classifyOutreachPath(url.pathname);

  if (request.headers.has("x-neuwave-actor")) {
    return new Response("actor is server-derived", { status: 400 });
  }

  switch (kind) {
    case "health":
      if (request.method === "GET") {
        return new Response("outreach origin compositor", { headers: { "content-type": "text/plain" } });
      }
      return new Response("method not allowed", { status: 405 });
    case "rest-rejected":
      return new Response("REST /rpc is not served; use Cap'n Web TaskDomainApi on /domain", { status: 404 });
    case "kernel-capnp":
      if (env.WORKSHOP) return env.WORKSHOP.fetch(request);
      if (env.LOCAL_KERNEL_API === "true" && env.USER) {
        return localKernelPublicApiFetcher(env.USER).fetch(request);
      }
      return new Response("kernel PublicApi is served by the Workshop worker on /api", { status: 404 });
    case "domain-capnp":
      return newWorkersRpcResponse(request, new TaskDomainTarget(env));
    case "streaming":
      return subscribeFromSession(request, env);
    case "webhook":
      return new Response("webhooks are served by the github-hooks worker", { status: 404 });
    case "oauth":
      return new Response("oauth callbacks are not served by the task-slice origin", { status: 404 });
    case "asset": {
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return new Response(OUTREACH_SHELL_STUB, {
        headers: {
          "content-type": "text/javascript; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }
    case "shell":
      return serveOutreachShell(request, env);
    default:
      return new Response("not found", { status: 404 });
  }
}

/** @deprecated REST JSON /rpc was removed (ADR-002). */
export const handleTaskSessionRequest = handleOutreachFetch;

export { KERNEL_PUBLIC_API_PATH, TASK_DOMAIN_API_PATH } from "./routes.js";
