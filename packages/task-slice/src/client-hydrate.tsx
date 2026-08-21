import { createElement, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { newWebSocketRpcSession, type RpcStub } from "capnweb";
import { CommandRegistry } from "shell";
import { Shell } from "shell";
import type { TaskPaneActivity, TaskPaneAlert, TaskPaneItem } from "shell";
import type { TaskDomainPublicApi, TaskSessionApi } from "./domain-api.js";
import { hashPasswordForKernel } from "./kernel-password.js";
import {
  bootLiveTaskSession,
  KERNEL_AUTH_TOKEN_KEY,
  loadTaskSurface,
  loginViaKernelPublicApi,
  createAccountViaKernelPublicApi,
  ORIGIN_MOUNTS,
  submitTaskCompose,
  TASK_TENANT_STORAGE_KEY,
  type KernelPasswordPublicApi,
} from "./live-session.js";
import type { OutreachBootConfig } from "./live-session.js";

function wsUrl(path: string): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}${path}`;
}

function readBoot(): OutreachBootConfig {
  const node = document.getElementById("outreach-boot");
  if (!node?.textContent) {
    return {
      ...ORIGIN_MOUNTS,
      authTokenKey: KERNEL_AUTH_TOKEN_KEY,
      tenantKey: TASK_TENANT_STORAGE_KEY,
      path: window.location.pathname,
    };
  }
  return JSON.parse(node.textContent) as OutreachBootConfig;
}

function surfaceItems(
  items: Awaited<ReturnType<typeof loadTaskSurface>>["items"],
): TaskPaneItem[] {
  return items.map((item) => ({
    entityId: item.entityId,
    title: item.title,
    facet: item.facet,
    done: item.done,
    status: item.status,
    priority: item.priority,
  }));
}

export function LiveOutreach({ boot = readBoot() }: { boot?: OutreachBootConfig }): ReactNode {
  const [token, setToken] = useState(() => localStorage.getItem(boot.authTokenKey) ?? "");
  const [username, setUsername] = useState(token ? token.slice(0, token.indexOf(":")) : "signed-out");
  const [authError, setAuthError] = useState("");
  const [items, setItems] = useState<TaskPaneItem[]>([]);
  const [activity, setActivity] = useState<TaskPaneActivity[]>([]);
  const [alerts, setAlerts] = useState<TaskPaneAlert[]>([]);
  const [sessionReady, setSessionReady] = useState(false);
  // RpcStub is thenable (Cap'n Web pipelining). React 19 useState unwraps thenables, so
  // the session must live on a ref — not in state — or create/markDone see a null session.
  const sessionRef = useRef<TaskSessionApi | null>(null);

  const applySurface = useCallback(async (live: TaskSessionApi) => {
    const surface = await loadTaskSurface(live);
    setItems(surfaceItems(surface.items));
    setActivity(surface.activity);
    setAlerts(surface.alerts);
  }, []);

  useEffect(() => {
    if (!token || (boot.path !== "/tasks" && !boot.path.startsWith("/tasks/"))) return;
    let cancelled = false;
    let domain: RpcStub<TaskDomainPublicApi> | undefined;
    let sub: WebSocket | undefined;
    sessionRef.current = null;
    setSessionReady(false);
    const storedTenant = localStorage.getItem(boot.tenantKey) ?? "";
    void (async () => {
      domain = newWebSocketRpcSession<TaskDomainPublicApi>(wsUrl(boot.domainApi));
      const live = await bootLiveTaskSession(domain, token, storedTenant || undefined);
      if (cancelled) return;
      const nextTenant = await live.tenantId();
      localStorage.setItem(boot.tenantKey, nextTenant);
      sessionRef.current = live;
      setSessionReady(true);
      setUsername(token.slice(0, token.indexOf(":")) || "signed-in");
      await applySurface(live);
      const cursor = await live.seq();
      sub = new WebSocket(
        `${wsUrl(boot.subscribe)}?cursor=${cursor}&token=${encodeURIComponent(token)}&tenant=${encodeURIComponent(nextTenant)}`,
      );
      sub.addEventListener("message", () => {
        void applySurface(live);
      });
    })().catch((error: unknown) => {
      if (!cancelled) setAuthError(error instanceof Error ? error.message : "session failed");
    });
    return () => {
      cancelled = true;
      sessionRef.current = null;
      sub?.close();
      domain?.[Symbol.dispose]();
    };
  }, [applySurface, boot.domainApi, boot.path, boot.subscribe, boot.tenantKey, token]);

  useEffect(() => {
    const registry = new CommandRegistry();
    registry.register({
      id: "global.create",
      scope: "global",
      chord: "c",
      priority: 0,
      registrationType: "override",
      runWithInputFocused: false,
      handle: () => {
        registry.activateLeader("c");
        return true;
      },
    });
    registry.register({
      id: "create-menu.task",
      scope: "command-scope-create-menu",
      chord: "t",
      priority: 0,
      registrationType: "override",
      runWithInputFocused: true,
      handle: () => {
        const input = document.querySelector<HTMLInputElement>('input[name="title"]');
        input?.focus();
        return true;
      },
    });
    registry.register({
      id: "global.go-to",
      scope: "global",
      chord: "g",
      priority: 0,
      registrationType: "override",
      runWithInputFocused: false,
      handle: () => {
        registry.activateLeader("g");
        return true;
      },
    });
    registry.register({
      id: "go-to.tasks",
      scope: "command-scope-go-to",
      chord: "t",
      priority: 0,
      registrationType: "override",
      runWithInputFocused: false,
      handle: () => {
        if (window.location.pathname !== "/tasks") window.location.assign("/tasks");
        return true;
      },
    });
    registry.register({
      id: "soup-entity.mark-done",
      scope: "global",
      chord: "e",
      priority: 0,
      registrationType: "add",
      runWithInputFocused: false,
      handle: () => {
        const focused = document.querySelector<HTMLElement>("[data-slice='task'] [data-focused='true']");
        const button = focused?.querySelector<HTMLButtonElement>("[data-command='soup-entity.mark-done'], [data-command='soup-entity.mark-not-done']");
        button?.click();
        return Boolean(button);
      },
    });
    registry.register({
      id: "soup-entity.rename",
      scope: "global",
      chord: "r",
      priority: 0,
      registrationType: "add",
      runWithInputFocused: false,
      handle: () => {
        const input = document.querySelector<HTMLInputElement>(
          "[data-slice='task'] [data-focused='true'] input[data-command='soup-entity.rename']",
        );
        input?.focus();
        input?.select();
        return Boolean(input);
      },
    });
    const onKey = (event: KeyboardEvent) => {
      const chord = event.key.length === 1 ? event.key.toLowerCase() : event.key.toLowerCase();
      const inputFocused = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      registry.dispatch({
        chord,
        inputFocused,
        touch: false,
        platform: navigator.platform.toLowerCase().includes("mac") ? "mac" : "non-mac",
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onKernelAuth = async (fields: { username: string; password: string; displayName: string }) => {
    setAuthError("");
    try {
      const hash = await hashPasswordForKernel(fields.username, fields.password);
      const publicApi = newWebSocketRpcSession<KernelPasswordPublicApi>(wsUrl(boot.kernelApi));
      const nextToken =
        boot.path === "/signup"
          ? await createAccountViaKernelPublicApi(
              publicApi,
              fields.username,
              fields.displayName || fields.username,
              hash,
            )
          : await loginViaKernelPublicApi(publicApi, fields.username, hash);
      localStorage.setItem(boot.authTokenKey, nextToken);
      const domain = newWebSocketRpcSession<TaskDomainPublicApi>(wsUrl(boot.domainApi));
      const live = await bootLiveTaskSession(domain, nextToken);
      const nextTenant = await live.tenantId();
      localStorage.setItem(boot.tenantKey, nextTenant);
      window.location.assign("/tasks");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "login failed");
    }
  };

  const onCreateTask = async (title: string) => {
    const session = sessionRef.current;
    if (!session) {
      setAuthError("task session is not ready");
      return;
    }
    try {
      const surface = await submitTaskCompose(session, title);
      setItems(surfaceItems(surface.items));
      setActivity(surface.activity);
      setAlerts(surface.alerts);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "create failed");
    }
  };

  const onMarkDone = async (entityId: string, done: boolean) => {
    const session = sessionRef.current;
    if (!session) {
      setAuthError("task session is not ready");
      return;
    }
    try {
      await session.markDone(entityId, done);
      await applySurface(session);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "update failed");
    }
  };

  const onRenameTask = async (entityId: string, title: string) => {
    const session = sessionRef.current;
    if (!session) {
      setAuthError("task session is not ready");
      return;
    }
    try {
      await session.updateTitle(entityId, title);
      await applySurface(session);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "rename failed");
    }
  };

  const onSetStatus = async (entityId: string, status: string) => {
    const session = sessionRef.current;
    if (!session) {
      setAuthError("task session is not ready");
      return;
    }
    try {
      await session.setStatus(entityId, status);
      await applySurface(session);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "status failed");
    }
  };

  const onSetPriority = async (entityId: string, priority: string) => {
    const session = sessionRef.current;
    if (!session) {
      setAuthError("task session is not ready");
      return;
    }
    try {
      await session.setPriority(entityId, priority === "none" ? "none" : priority);
      await applySurface(session);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "priority failed");
    }
  };

  return createElement(Shell, {
    path: boot.path,
    theme: "outreach-dark",
    username,
    taskItems: items,
    taskComposeOpen: true,
    activityFacts: activity,
    operatorAlerts: alerts,
    kernelAuthError: authError,
    sessionReady,
    onKernelAuth,
    onCreateTask,
    onMarkDone,
    onRenameTask,
    onSetStatus,
    onSetPriority,
  });
}
