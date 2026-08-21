import { requestContext } from "control-plane";
import {
  bindKernelSession,
  bearerToken,
  DurableTeamsApi,
  SEED_ADMIN,
  SEED_MEMBER,
  SEED_OUTSIDER,
  SessionBindError,
} from "identity";
import type { ActorContext } from "identity/principal";
import { DurableTaskApi } from "./durable-task-api.js";
import type { TaskSliceDurableObject } from "./task-do.js";

interface KernelUserDo {
  authenticate(secret: string): Promise<void>;
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
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

function seedDirectory(teams: DurableTeamsApi): DurableTeamsApi {
  teams.registerKernelUser(SEED_ADMIN);
  teams.registerKernelUser(SEED_MEMBER);
  teams.registerKernelUser(SEED_OUTSIDER);
  return teams;
}

async function actorFromRequest(request: Request, env: TaskWorkerEnv): Promise<ActorContext> {
  const token = bearerToken(request);
  const tenantId = request.headers.get("x-neuwave-tenant");
  if (!token || !tenantId) {
    throw new SessionBindError(401, "session required");
  }
  if (!env.USER || !env.TEAM) {
    throw new SessionBindError(401, "session bindings unavailable");
  }
  const teams = seedDirectory(new DurableTeamsApi(env.TEAM, new Set(["admin"])));
  return bindKernelSession({
    token,
    tenantId,
    directory: teams,
    authenticate: (username, secret) => env.USER!.get(env.USER!.idFromName(username)).authenticate(secret),
    memberRole: async (userId, teamId) => {
      const session = teams.users.get(userId);
      if (!session) return null;
      return teams.resolveEffectiveRole(session, teamId);
    },
  });
}

export async function handleTaskSessionRequest(request: Request, env: TaskWorkerEnv): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/" && request.method === "GET") {
    return new Response("outreach task-slice worker", { headers: { "content-type": "text/plain" } });
  }
  if (request.headers.has("x-neuwave-actor")) {
    return new Response("actor is server-derived", { status: 400 });
  }

  let actor: ActorContext;
  try {
    actor = await actorFromRequest(request, env);
  } catch (error) {
    if (error instanceof SessionBindError) {
      return new Response(error.message, { status: error.status });
    }
    return new Response(error instanceof Error ? error.message : "session failed", { status: 401 });
  }

  const tenantId = request.headers.get("x-neuwave-tenant")!;
  const api = new DurableTaskApi(env.TASK_SLICE as never, tenantId);

  if (url.pathname === "/subscribe") {
    const cursor = Number(url.searchParams.get("cursor") ?? "0");
    return api.subscribe(cursor, actor);
  }

  if (request.method !== "POST" || url.pathname !== "/rpc") {
    return new Response("not found", { status: 404 });
  }

  const body = (await request.json()) as {
    op?: string;
    title?: string;
    entityId?: string;
    correlationId?: string;
    actor?: unknown;
  };
  if (body.actor !== undefined) {
    return new Response("actor is server-derived", { status: 400 });
  }

  const ctx = requestContext(actor, { correlationId: body.correlationId });
  try {
    switch (body.op) {
      case "createTask": {
        if (!body.title) return new Response("title required", { status: 400 });
        const view = await api.createTask(body.title, ctx);
        return Response.json({ ok: true, task: view.task });
      }
      case "listTasks": {
        const items = await api.listVisible(actor);
        return Response.json({ ok: true, items });
      }
      case "updateTitle": {
        if (!body.entityId || !body.title) return new Response("entityId and title required", { status: 400 });
        const minted = await env.TASK_SLICE.get(env.TASK_SLICE.idFromName(tenantId)).mintView(
          actor,
          body.entityId,
          "edit",
        );
        if (!minted.ok) return new Response(minted.message, { status: 403 });
        const task = await api.updateTitle(body.title, requestContext(actor, { receipt: minted.receipt, correlationId: body.correlationId }));
        return Response.json({ ok: true, task });
      }
      default:
        return new Response("unknown op", { status: 400 });
    }
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "rpc failed", { status: 400 });
  }
}
