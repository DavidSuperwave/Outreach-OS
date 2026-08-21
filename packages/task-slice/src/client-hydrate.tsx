import { createElement, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { newWebSocketRpcSession, type RpcStub } from "capnweb";
import { CommandRegistry, chordFromEvent } from "shell";
import { Shell } from "shell";
import type { TaskPaneActivity, TaskPaneAlert, TaskPaneItem } from "shell";
import {
  chromeActiveScope,
  defaultChromeContext,
  defaultChromeHotkeyHandle,
  filterCommandMenuItems,
  commandMenuCategoryFromId,
  COMMAND_MENU_NESTED_LEADERS,
  nextCommandMenuCategory,
  isFullCoverRoute,
  persistTheme,
  registerChromeHotkeys,
  STORAGE_KEYS,
  type CommandMenuCategory,
  type CommandMenuScope,
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

export const OPEN_TASK_COMPOSE_KEY = "outreach-open-task-compose";

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

function handleLiveSliceHotkey(
  id: string,
  ui: {
    openCreateMenu: () => boolean;
    openTaskCompose: () => boolean;
    openCommandCategory: (id: string) => boolean;
  },
): boolean {
  switch (id) {
    case "global.create":
      return ui.openCreateMenu();
    case "global.go-to":
    case "global.open-category-leader":
      return true;
    case "create-menu.task":
    case "launcher.task":
      return ui.openTaskCompose();
    case "command-menu.open-category.tasks":
      return ui.openCommandCategory(id);
    case "go-to.tasks":
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
  const [commandQuery, setCommandQuery] = useState("");
  const [commandCategory, setCommandCategory] = useState<CommandMenuCategory>("all");
  const [commandSelectedIndex, setCommandSelectedIndex] = useState(0);
  const [commandScope, setCommandScope] = useState<CommandMenuScope>("root");
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [taskComposeOpen, setTaskComposeOpen] = useState(() => {
    try {
      return sessionStorage.getItem(OPEN_TASK_COMPOSE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.sidebarCollapsed) === "1";
    } catch {
      return false;
    }
  });
  const [theme, setTheme] = useState<ThemeId>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.theme);
    return stored === "outreach-light" || stored === "outreach-dark" ? stored : "outreach-dark";
  });
  // RpcStub is thenable (Cap'n Web pipelining). React 19 useState unwraps thenables, so
  // the session must live on a ref — not in state — or create/markDone see a null session.
  const sessionRef = useRef<TaskSessionApi | null>(null);
  const registryRef = useRef<CommandRegistry | null>(null);
  const commandMenuOpenRef = useRef(commandMenuOpen);
  const commandQueryRef = useRef(commandQuery);
  const commandCategoryRef = useRef(commandCategory);
  const commandSelectedIndexRef = useRef(commandSelectedIndex);
  const commandScopeRef = useRef(commandScope);
  const createMenuOpenRef = useRef(createMenuOpen);
  const taskComposeOpenRef = useRef(taskComposeOpen);
  const selectCommandRef = useRef<(id: string) => void>(() => undefined);
  commandMenuOpenRef.current = commandMenuOpen;
  commandQueryRef.current = commandQuery;
  commandCategoryRef.current = commandCategory;
  commandSelectedIndexRef.current = commandSelectedIndex;
  commandScopeRef.current = commandScope;
  createMenuOpenRef.current = createMenuOpen;
  taskComposeOpenRef.current = taskComposeOpen;

  const resetPalette = (category: CommandMenuCategory = "all") => {
    setCommandQuery("");
    commandQueryRef.current = "";
    setCommandCategory(category);
    commandCategoryRef.current = category;
    setCommandSelectedIndex(0);
    commandSelectedIndexRef.current = 0;
    setCommandScope("root");
    commandScopeRef.current = "root";
  };

  const closeMenus = useCallback(() => {
    setCommandMenuOpen(false);
    setCreateMenuOpen(false);
    setTaskComposeOpen(false);
    commandMenuOpenRef.current = false;
    createMenuOpenRef.current = false;
    taskComposeOpenRef.current = false;
    registryRef.current?.jettison();
    return true;
  }, []);

  const toggleCreateMenu = useCallback(() => {
    const next = !createMenuOpenRef.current;
    createMenuOpenRef.current = next;
    setCreateMenuOpen(next);
    if (next) {
      setCommandMenuOpen(false);
      commandMenuOpenRef.current = false;
      registryRef.current?.activateLeader("c");
    } else {
      registryRef.current?.jettison();
    }
    return true;
  }, []);

  const toggleCommandMenu = useCallback(() => {
    const next = !commandMenuOpenRef.current;
    commandMenuOpenRef.current = next;
    setCommandMenuOpen(next);
    if (next) {
      setCreateMenuOpen(false);
      createMenuOpenRef.current = false;
      resetPalette("all");
      registryRef.current?.jettison();
    }
    return true;
  }, []);

  const openCommandScope = useCallback((id: string) => {
    const nested = COMMAND_MENU_NESTED_LEADERS[id];
    if (!nested) return false;
    setCommandScope(nested);
    commandScopeRef.current = nested;
    setCommandQuery("");
    commandQueryRef.current = "";
    setCommandSelectedIndex(0);
    commandSelectedIndexRef.current = 0;
    setCommandMenuOpen(true);
    commandMenuOpenRef.current = true;
    setCreateMenuOpen(false);
    createMenuOpenRef.current = false;
    return true;
  }, []);

  const backCommandScope = useCallback(() => {
    if (commandScopeRef.current === "root") return false;
    setCommandScope("root");
    commandScopeRef.current = "root";
    setCommandQuery("");
    commandQueryRef.current = "";
    setCommandSelectedIndex(0);
    commandSelectedIndexRef.current = 0;
    return true;
  }, []);

  const openCommandCategory = useCallback((id: string) => {
    const category = commandMenuCategoryFromId(id) ?? "all";
    resetPalette(category);
    setCommandMenuOpen(true);
    commandMenuOpenRef.current = true;
    setCreateMenuOpen(false);
    createMenuOpenRef.current = false;
    registryRef.current?.jettison();
    return true;
  }, []);

  const moveCommandSelection = useCallback((delta: number) => {
    const items = filterCommandMenuItems(
      commandQueryRef.current,
      commandCategoryRef.current,
      commandScopeRef.current,
    );
    if (items.length === 0) return true;
    const next = (commandSelectedIndexRef.current + delta + items.length) % items.length;
    commandSelectedIndexRef.current = next;
    setCommandSelectedIndex(next);
    return true;
  }, []);

  const confirmCommandSelection = useCallback(() => {
    const items = filterCommandMenuItems(
      commandQueryRef.current,
      commandCategoryRef.current,
      commandScopeRef.current,
    );
    const item = items[commandSelectedIndexRef.current] ?? items[0];
    if (item) selectCommandRef.current(item.id);
    return true;
  }, []);

  const cycleCommandCategory = useCallback((delta: number) => {
    if (!commandMenuOpenRef.current || commandScopeRef.current !== "root") return false;
    const next = nextCommandMenuCategory(commandCategoryRef.current, delta);
    setCommandCategory(next);
    commandCategoryRef.current = next;
    setCommandSelectedIndex(0);
    commandSelectedIndexRef.current = 0;
    return true;
  }, []);

  const openTaskCompose = useCallback(() => {
    try {
      sessionStorage.removeItem(OPEN_TASK_COMPOSE_KEY);
    } catch {
      /* ignore */
    }
    setCreateMenuOpen(false);
    createMenuOpenRef.current = false;
    setCommandMenuOpen(false);
    commandMenuOpenRef.current = false;
    setTaskComposeOpen(true);
    taskComposeOpenRef.current = true;
    registryRef.current?.jettison();
    return true;
  }, []);

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
    if (!taskComposeOpen) return;
    try {
      sessionStorage.removeItem(OPEN_TASK_COMPOSE_KEY);
    } catch {
      /* ignore */
    }
    const input = document.querySelector<HTMLInputElement>(
      '[data-scope="task-compose-popover"] input[name="title"]',
    );
    input?.focus();
  }, [taskComposeOpen]);

  useEffect(() => {
    const registry = new CommandRegistry();
    registryRef.current = registry;
    registry.setActive(chromeActiveScope(boot.path, { commandMenuOpen }));
    const navigate = (path: string) => {
      if (window.location.pathname + window.location.search !== path) window.location.assign(path);
    };
    const handleChrome = defaultChromeHotkeyHandle(navigate, {
      enabled: () =>
        defaultChromeContext({
          signedIn: Boolean(token),
          commandMenuOpen: commandMenuOpenRef.current,
          settingsOpen: boot.path === "/settings" || boot.path === "/mcp" || boot.path.startsWith("/settings"),
          settingsTabCount: 3,
          createMenuOpen: createMenuOpenRef.current,
          splitCount: 1,
          canAppendSplit: true,
          leader: registry.leader,
          fullCoverRoute: isFullCoverRoute(boot.path),
          sidebarMounted: !isFullCoverRoute(boot.path),
        }),
      toggleCommandMenu,
      toggleCreateMenu,
      openTaskCompose: () => {
        if (isTaskPath(boot.path)) return openTaskCompose();
        try {
          sessionStorage.setItem(OPEN_TASK_COMPOSE_KEY, "1");
        } catch {
          /* ignore */
        }
        navigate("/tasks");
        return true;
      },
      openCommandCategory,
      cycleCommandCategory,
      openCommandScope,
      backCommandScope,
      commandQueryEmpty: () => commandQueryRef.current.trim() === "",
      moveCommandSelection,
      confirmCommandSelection,
      closeMenus,
      logout: () => {
        localStorage.removeItem(boot.authTokenKey);
        localStorage.removeItem(boot.tenantKey);
        window.location.assign("/login");
        return true;
      },
      applyTheme: (next, kind = "visible") => {
        persistTheme(next, kind);
        if (kind === "visible") setTheme(next);
        return true;
      },
      toggleSidebar: () => {
        setSidebarCollapsed((value) => {
          const next = !value;
          try {
            localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, next ? "1" : "0");
          } catch {
            /* ignore */
          }
          return next;
        });
        return true;
      },
    });
    registerChromeHotkeys(registry, handleChrome);
    if (isTaskPath(boot.path) && !commandMenuOpen) {
      registerSliceHotkeys(registry, (id) =>
        handleLiveSliceHotkey(id, {
          openCreateMenu: toggleCreateMenu,
          openTaskCompose,
          openCommandCategory,
        }),
      );
    }
    const onKey = (event: KeyboardEvent) => {
      const inputFocused =
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement;
      const chord = chordFromEvent(event);
      if (inputFocused && taskComposeOpenRef.current && chord !== "escape") {
        return;
      }
      const id = registry.dispatch({
        chord,
        inputFocused,
        touch: false,
        platform: navigator.platform.toLowerCase().includes("mac") ? "mac" : "non-mac",
      });
      if (id) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (
        chord === "escape" &&
        (commandMenuOpenRef.current || createMenuOpenRef.current || taskComposeOpenRef.current)
      ) {
        closeMenus();
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      if (registryRef.current === registry) registryRef.current = null;
    };
  }, [
    boot.authTokenKey,
    boot.path,
    boot.tenantKey,
    closeMenus,
    commandMenuOpen,
    confirmCommandSelection,
    moveCommandSelection,
    openCommandCategory,
    cycleCommandCategory,
    openCommandScope,
    backCommandScope,
    openTaskCompose,
    toggleCommandMenu,
    toggleCreateMenu,
    token,
  ]);

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
      setTaskComposeOpen(false);
      taskComposeOpenRef.current = false;
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

  const chromeClick = (id: string) => {
    if (id.startsWith("command-menu.open-category.")) {
      openCommandCategory(id);
      return;
    }
    if (COMMAND_MENU_NESTED_LEADERS[id] || id === "command-menu.backspace-back") {
      defaultChromeHotkeyHandle(() => undefined, {
        openCommandScope,
        backCommandScope,
        commandQueryEmpty: () => commandQueryRef.current.trim() === "",
        closeMenus,
        enabled: () =>
          defaultChromeContext({
            signedIn: Boolean(token),
            commandMenuOpen: true,
          }),
      })(id);
      return;
    }
    if (id === "create-menu.task" || id === "launcher.task" || id === "launcher.task-new-split") {
      if (isTaskPath(boot.path)) {
        openTaskCompose();
        return;
      }
      try {
        sessionStorage.setItem(OPEN_TASK_COMPOSE_KEY, "1");
      } catch {
        /* ignore */
      }
      window.location.assign("/tasks");
      return;
    }
    defaultChromeHotkeyHandle(
      (path) => window.location.assign(path),
      {
        enabled: () =>
          defaultChromeContext({
            signedIn: Boolean(token),
            commandMenuOpen: commandMenuOpenRef.current,
            createMenuOpen: createMenuOpenRef.current,
            leader: registryRef.current?.leader ?? (createMenuOpenRef.current ? "c" : null),
            fullCoverRoute: isFullCoverRoute(boot.path),
            sidebarMounted: !isFullCoverRoute(boot.path),
          }),
        logout: () => {
          localStorage.removeItem(boot.authTokenKey);
          localStorage.removeItem(boot.tenantKey);
          window.location.assign("/login");
          return true;
        },
        applyTheme: (next, kind = "visible") => {
          persistTheme(next, kind);
          if (kind === "visible") setTheme(next);
          return true;
        },
        closeMenus,
        openTaskCompose: () => {
          if (isTaskPath(boot.path)) return openTaskCompose();
          try {
            sessionStorage.setItem(OPEN_TASK_COMPOSE_KEY, "1");
          } catch {
            /* ignore */
          }
          window.location.assign("/tasks");
          return true;
        },
        toggleCreateMenu,
        toggleCommandMenu,
        openCommandCategory,
        cycleCommandCategory,
        openCommandScope,
        backCommandScope,
        commandQueryEmpty: () => commandQueryRef.current.trim() === "",
        moveCommandSelection,
        confirmCommandSelection,
      },
    )(id);
  };
  selectCommandRef.current = chromeClick;

  return createElement(Shell, {
    path: boot.path,
    theme,
    username,
    taskItems: items,
    taskComposeOpen,
    activityFacts: activity,
    operatorAlerts: alerts,
    kernelAuthError: authError,
    sessionReady,
    commandMenuOpen,
    createMenuOpen,
    commandQuery,
    commandCategory,
    commandSelectedIndex,
    commandScope,
    sidebarCollapsed,
    onToggleCommandMenu: toggleCommandMenu,
    onToggleCreateMenu: toggleCreateMenu,
    onToggleSidebar: () => {
      setSidebarCollapsed((value) => {
        const next = !value;
        try {
          localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, next ? "1" : "0");
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    onCommandQueryChange: (query) => {
      setCommandQuery(query);
      commandQueryRef.current = query;
      setCommandSelectedIndex(0);
      commandSelectedIndexRef.current = 0;
    },
    onCommandMenuSelect: chromeClick,
    onCreateMenuSelect: chromeClick,
    onKernelAuth,
    onCreateTask,
    onMarkDone,
    onRenameTask,
    onSetStatus,
    onSetPriority,
    onSetAssignee,
  });
}
