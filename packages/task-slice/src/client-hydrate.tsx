import { createElement, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { newWebSocketRpcSession, type RpcStub } from "capnweb";
import { CommandRegistry, chordFromEvent } from "shell";
import { Shell } from "shell";
import type { TaskPaneActivity, TaskPaneAlert, TaskPaneItem } from "shell";
import {
  chromeActiveScope,
  defaultChromeContext,
  defaultChromeHotkeyHandle,
  persistTheme,
  registerChromeHotkeys,
  STORAGE_KEYS,
  type ThemeId,
} from "shell";
import { registerSliceHotkeys } from "./slice-hotkeys.js";
import type { TaskDomainPublicApi, TaskSessionApi } from "./domain-api.js";
import { hashPasswordForKernel } from "./kernel-password.js";
import {
  attachTaskSubscribe,
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

function isTaskPath(path: string): boolean {
  return path === "/tasks" || path.startsWith("/tasks/");
}

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

function focusedTaskRow(): HTMLElement | null {
  return document.querySelector("[data-slice='task'] [data-focused='true']");
}

function focusInFocusedRow(selector: string): boolean {
  const node = focusedTaskRow()?.querySelector<HTMLElement>(selector);
  node?.focus();
  if (node instanceof HTMLInputElement) node.select();
  return Boolean(node);
}

function clickInFocusedRow(selector: string): boolean {
  const node = focusedTaskRow()?.querySelector<HTMLElement>(selector);
  node?.click();
  return Boolean(node);
}

function clickSliceCommand(command: string): boolean {
  const node = document.querySelector<HTMLElement>(`[data-slice='task'] [data-command='${command}']`);
  node?.click();
  return Boolean(node);
}

function handleLiveSliceHotkey(id: string): boolean {
  switch (id) {
    case "global.create":
    case "global.go-to":
    case "global.open-category-leader":
      return true;
    case "create-menu.task":
    case "launcher.task": {
      const input = document.querySelector<HTMLInputElement>(
        '[data-scope="task-compose-popover"] input[name="title"]',
      );
      input?.focus();
      return Boolean(input);
    }
    case "go-to.tasks":
    case "command-menu.open-category.tasks":
      if (window.location.pathname !== "/tasks") window.location.assign("/tasks");
      return true;
    case "soup.tab-1":
    case "soup.tab-2":
    case "soup.tab-3":
      return clickSliceCommand(id);
    case "soup.open": {
      const row = focusedTaskRow();
      row?.setAttribute("data-opened", "true");
      row?.click();
      return Boolean(row);
    }
    case "soup-entity.mark-done":
      return clickInFocusedRow("[data-command='soup-entity.mark-done']");
    case "soup-entity.mark-not-done":
      return clickInFocusedRow("[data-command='soup-entity.mark-not-done']");
    case "soup-entity.rename":
      return focusInFocusedRow("input[data-command='soup-entity.rename']");
    case "soup-entity.status":
    case "soup-entity.properties":
      return focusInFocusedRow("[data-command='soup-entity.status'], select[aria-label='Status']");
    case "soup-entity.priority":
      return focusInFocusedRow("[data-command='soup-entity.priority'], select[aria-label='Priority']");
    case "soup-entity.assignee":
      return focusInFocusedRow("input[data-command='soup-entity.assignee']");
    case "soup-entity.tags":
      return focusInFocusedRow("input[data-command='soup-entity.tags']");
    case "soup-nav.down-j":
    case "soup-nav.down-arrow":
      return clickSliceCommand("soup-nav.down-j");
    case "soup-nav.up-k":
    case "soup-nav.up-arrow":
      return clickSliceCommand("soup-nav.up-k");
    default:
      return false;
  }
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
    assigneeIds: item.assigneeIds,
    tags: item.tags,
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
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<ThemeId>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.theme);
    return stored === "outreach-light" || stored === "outreach-dark" ? stored : "outreach-dark";
  });
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
    let stopSubscribe: (() => void) | undefined;
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
      if (cancelled) return;
      const sub = attachTaskSubscribe({
        open: (url) => new WebSocket(url),
        subscribePath: wsUrl(boot.subscribe),
        token,
        tenant: nextTenant,
        session: live,
        onDelta: () => {
          void applySurface(live);
        },
        onError: (error) => {
          if (!cancelled) setAuthError(error instanceof Error ? error.message : "subscribe failed");
        },
      });
      stopSubscribe = () => sub.close();
    })().catch((error: unknown) => {
      if (!cancelled) setAuthError(error instanceof Error ? error.message : "session failed");
    });
    return () => {
      cancelled = true;
      sessionRef.current = null;
      stopSubscribe?.();
      domain?.[Symbol.dispose]();
    };
  }, [applySurface, boot.domainApi, boot.path, boot.subscribe, boot.tenantKey, token]);

  useEffect(() => {
    const registry = new CommandRegistry();
    registry.setActive(chromeActiveScope(boot.path, { commandMenuOpen }));
    const navigate = (path: string) => {
      if (window.location.pathname + window.location.search !== path) window.location.assign(path);
    };
    const handleChrome = defaultChromeHotkeyHandle(navigate, {
      enabled: () =>
        defaultChromeContext({
          signedIn: Boolean(token),
          commandMenuOpen,
          settingsOpen: boot.path === "/settings" || boot.path === "/mcp" || boot.path.startsWith("/settings"),
          settingsTabCount: 3,
          createMenuOpen: false,
          splitCount: 1,
          canAppendSplit: true,
          leader: registry.leader,
        }),
      toggleCommandMenu: () => {
        setCommandMenuOpen((open) => !open);
        return true;
      },
      closeMenus: () => {
        setCommandMenuOpen(false);
        return true;
      },
      logout: () => {
        localStorage.removeItem(boot.authTokenKey);
        localStorage.removeItem(boot.tenantKey);
        window.location.assign("/login");
        return true;
      },
      applyTheme: (next, kind = "visible") => {
        persistTheme(next, kind);
        if (kind === "visible") setTheme(next === "outreach-light" ? "outreach-light" : "outreach-dark");
        return true;
      },
      toggleSidebar: () => {
        setSidebarCollapsed((value) => !value);
        return true;
      },
    });
    registerChromeHotkeys(registry, handleChrome);
    if (isTaskPath(boot.path) && !commandMenuOpen) {
      registerSliceHotkeys(registry, handleLiveSliceHotkey);
    }
    const onKey = (event: KeyboardEvent) => {
      const inputFocused =
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement;
      const id = registry.dispatch({
        chord: chordFromEvent(event),
        inputFocused,
        touch: false,
        platform: navigator.platform.toLowerCase().includes("mac") ? "mac" : "non-mac",
      });
      if (id) event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [boot.authTokenKey, boot.path, boot.tenantKey, commandMenuOpen, token]);

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

  const onSetAssignee = async (entityId: string, assigneeId: string) => {
    const session = sessionRef.current;
    if (!session) {
      setAuthError("task session is not ready");
      return;
    }
    try {
      await session.setAssignee(entityId, assigneeId);
      await applySurface(session);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "assignee failed");
    }
  };

  return createElement(Shell, {
    path: boot.path,
    theme,
    username,
    taskItems: items,
    taskComposeOpen: true,
    activityFacts: activity,
    operatorAlerts: alerts,
    kernelAuthError: authError,
    sessionReady,
    commandMenuOpen,
    sidebarCollapsed,
    onToggleCommandMenu: () => setCommandMenuOpen((open) => !open),
    onCommandMenuSelect: (id) => {
      defaultChromeHotkeyHandle(
        (path) => window.location.assign(path),
        {
          enabled: defaultChromeContext({ signedIn: Boolean(token), commandMenuOpen: true }),
          logout: () => {
            localStorage.removeItem(boot.authTokenKey);
            localStorage.removeItem(boot.tenantKey);
            window.location.assign("/login");
            return true;
          },
          applyTheme: (next, kind = "visible") => {
            persistTheme(next, kind);
            if (kind === "visible") setTheme(next === "outreach-light" ? "outreach-light" : "outreach-dark");
            return true;
          },
          closeMenus: () => {
            setCommandMenuOpen(false);
            return true;
          },
        },
      )(id);
      if (id !== "global.command-menu") setCommandMenuOpen(false);
    },
    onKernelAuth,
    onCreateTask,
    onMarkDone,
    onRenameTask,
    onSetStatus,
    onSetPriority,
    onSetAssignee,
  });
}
