import { createElement, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { newWebSocketRpcSession, type RpcStub } from "capnweb";
import { CommandRegistry, chordFromEvent } from "shell";
import { Shell } from "shell";
import type { TaskPaneActivity, TaskPaneAlert, TaskPaneItem } from "shell";
import {
  chromeActiveScope,
  defaultChromeContext,
  defaultChromeHotkeyHandle,
  CREATE_MENU_ITEMS,
  filterCommandMenuItems,
  commandMenuCategoryFromId,
  COMMAND_MENU_NESTED_LEADERS,
  LEADER_HINT_RESET_MS, // wrangler rebuilds when this hydrate entry changes
  nextCommandMenuCategory,
  isFullCoverRoute,
  isAuthCoverPath,
  POST_AUTH_PATH,
  persistTheme,
  readUserThemes,
  registerChromeHotkeys,
  STORAGE_KEYS,
  chromeInputFocused,
  isThemeId,
  isUserThemeId,
  panesFromPath,
  appendTaskSplitPath,
  closeSplitAtPath,
  type UserTheme,
  type CommandMenuCategory,
  type CommandMenuScope,
  type LeaderKey,
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
  newTaskOperationId,
  ORIGIN_MOUNTS,
  submitTaskCompose,
  TASK_TENANT_STORAGE_KEY,
  type KernelPasswordPublicApi,
} from "./live-session.js";
import type { OutreachBootConfig } from "./live-session.js";
import { TaskOperationController } from "./task-operation-controller.js";

export const OPEN_TASK_COMPOSE_KEY = "outreach-open-task-compose";

export interface HydrateSplitState {
  focusedIndex: number;
  spotlightIndex: number | null;
  previewOpen: boolean;
  drawerOpen: boolean;
}

export interface HydrateSplitControllerOptions {
  path: () => string;
  navigate: (path: string) => void;
  getState: () => HydrateSplitState;
  setState: (update: (current: HydrateSplitState) => HydrateSplitState) => void;
  history: Pick<History, "go" | "length">;
  closePopover: () => boolean;
  focusSplit?: (index: number) => void;
}

/** Actual URL/component-state adapter used by the hydrate command handler and integration tests. */
export function createHydrateSplitController(options: HydrateSplitControllerOptions) {
  const focusNode = options.focusSplit ?? ((index: number) => {
    document.querySelector<HTMLElement>(`[data-split-index="${index}"]`)?.focus();
  });
  return {
    closeSplit: () => {
      const state = options.getState();
      const path = closeSplitAtPath(options.path(), state.focusedIndex);
      options.navigate(path);
      return true;
    },
    toggleSplitSpotlight: () => {
      const panes = panesFromPath(options.path());
      if (panes.length < 2) return false;
      options.setState((state) => ({
        ...state,
        spotlightIndex: state.spotlightIndex === state.focusedIndex ? null : state.focusedIndex,
      }));
      return true;
    },
    splitHistory: (delta: -1 | 1) => {
      if (options.history.length <= 1) return false;
      options.history.go(delta);
      return true;
    },
    focusSplit: (delta: -1 | 1) => {
      const count = panesFromPath(options.path()).length;
      if (count < 2) return false;
      let next = 0;
      options.setState((state) => {
        next = (state.focusedIndex + delta + count) % count;
        return { ...state, focusedIndex: next, spotlightIndex: state.spotlightIndex === null ? null : next };
      });
      queueMicrotask(() => focusNode(next));
      return true;
    },
    toggleSplitPreview: () => {
      const state = options.getState();
      const pane = panesFromPath(options.path())[state.focusedIndex];
      if (!pane || ["pdf", "image", "video", "preview"].includes(pane.type)) return false;
      options.setState((current) => ({ ...current, previewOpen: !current.previewOpen }));
      return true;
    },
    closeSplitDrawer: () => {
      if (!options.getState().drawerOpen) return false;
      options.setState((state) => ({ ...state, drawerOpen: false }));
      return true;
    },
    closePopoverSplit: options.closePopover,
  };
}

export interface HydrateCaptureOptions {
  registry: CommandRegistry;
  target?: Window;
  taskComposeOpen: () => boolean;
  commandMenuOpen: () => boolean;
  createMenuOpen: () => boolean;
  closeMenus: () => boolean;
  setArmedLeader: (leader: LeaderKey | null) => void;
}

/** The real capture-phase keyboard adapter; exported so tests execute the same listener as hydrate. */
export function installHydrateCaptureHandler(options: HydrateCaptureOptions): () => void {
  const target = options.target ?? window;
  const onKey = (event: KeyboardEvent) => {
    const formControl =
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement;
    const soupCell =
      event.target instanceof HTMLElement &&
      Boolean(event.target.closest("[data-slice='task']")) &&
      !event.target.closest("[data-scope='task-compose-popover']") &&
      !event.target.closest("[data-surface='command-menu']") &&
      !event.target.closest("[data-surface='create-menu']");
    const chord = chordFromEvent(event);
    const inputFocused = chromeInputFocused(formControl, soupCell, chord);
    if (formControl && options.taskComposeOpen() && chord !== "escape") return;
    const leaderBefore = options.registry.leader;
    const id = options.registry.dispatch({
      chord,
      inputFocused,
      touch: false,
      platform: navigator.platform.toLowerCase().includes("mac") ? "mac" : "non-mac",
    });
    if (id === "global.go-to" || id === "global.go-to-leader") options.setArmedLeader("g");
    else if (id === "global.open-category-leader") options.setArmedLeader("o");
    else if (id === "global.create") options.setArmedLeader("c");
    else options.setArmedLeader(options.registry.leader);
    if (id) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (leaderBefore && options.registry.leader !== leaderBefore) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (
      chord === "escape" &&
      (options.commandMenuOpen() || options.createMenuOpen() || options.taskComposeOpen())
    ) {
      options.closeMenus();
      event.preventDefault();
    }
  };
  target.addEventListener("keydown", onKey, true);
  return () => target.removeEventListener("keydown", onKey, true);
}

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
    openTaskCompose: (preferNewSplit?: boolean) => boolean;
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
    case "launcher.task-new-split":
      return ui.openTaskCompose(true);
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
      if (focusInFocusedRow("input[data-command='soup-entity.rename']")) return true;
      return clickInFocusedRow("button[data-command='soup-entity.rename']");
    case "soup-entity.status":
    case "soup-entity.properties":
      if (focusInFocusedRow("select[aria-label='Status']")) return true;
      return clickInFocusedRow("[data-command='soup-entity.status']");
    case "soup-entity.priority":
      if (focusInFocusedRow("select[aria-label='Priority']")) return true;
      return clickInFocusedRow("[data-command='soup-entity.priority']");
    case "soup-entity.assignee":
      if (focusInFocusedRow("input[data-command='soup-entity.assignee']")) return true;
      return clickInFocusedRow("button[data-command='soup-entity.assignee']");
    case "soup-entity.tags":
      if (focusInFocusedRow("input[data-command='soup-entity.tags']")) return true;
      return clickInFocusedRow("button[data-command='soup-entity.tags']");
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
  const [createMenuViaLeader, setCreateMenuViaLeader] = useState(false);
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
  const [armedLeader, setArmedLeader] = useState<LeaderKey | null>(null);
  const [userThemes] = useState<readonly UserTheme[]>(() => readUserThemes());
  const [theme, setTheme] = useState<string>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.theme);
    return isThemeId(stored) || isUserThemeId(stored, userThemes) ? stored! : "outreach-dark";
  });
  const [splitState, setSplitState] = useState<HydrateSplitState>({
    focusedIndex: 0,
    spotlightIndex: null,
    previewOpen: false,
    drawerOpen: false,
  });
  // RpcStub is thenable (Cap'n Web pipelining). React 19 useState unwraps thenables, so
  // the session must live on a ref — not in state — or create/markDone see a null session.
  const sessionRef = useRef<TaskSessionApi | null>(null);
  const taskOperationsRef = useRef(new TaskOperationController(newTaskOperationId));
  const registryRef = useRef<CommandRegistry | null>(null);
  const commandMenuOpenRef = useRef(commandMenuOpen);
  const commandQueryRef = useRef(commandQuery);
  const commandCategoryRef = useRef(commandCategory);
  const commandSelectedIndexRef = useRef(commandSelectedIndex);
  const commandScopeRef = useRef(commandScope);
  const createMenuOpenRef = useRef(createMenuOpen);
  const createMenuViaLeaderRef = useRef(createMenuViaLeader);
  const taskComposeOpenRef = useRef(taskComposeOpen);
  const splitStateRef = useRef(splitState);
  const selectCommandRef = useRef<(id: string, preferNewSplit?: boolean) => void>(() => undefined);
  commandMenuOpenRef.current = commandMenuOpen;
  commandQueryRef.current = commandQuery;
  commandCategoryRef.current = commandCategory;
  commandSelectedIndexRef.current = commandSelectedIndex;
  commandScopeRef.current = commandScope;
  createMenuOpenRef.current = createMenuOpen;
  createMenuViaLeaderRef.current = createMenuViaLeader;
  taskComposeOpenRef.current = taskComposeOpen;
  splitStateRef.current = splitState;

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

  const syncArmedLeader = useCallback(() => {
    setArmedLeader(registryRef.current?.leader ?? null);
  }, []);

  const closeMenus = useCallback(() => {
    setCommandMenuOpen(false);
    setCreateMenuOpen(false);
    setCreateMenuViaLeader(false);
    setTaskComposeOpen(false);
    commandMenuOpenRef.current = false;
    createMenuOpenRef.current = false;
    createMenuViaLeaderRef.current = false;
    taskComposeOpenRef.current = false;
    registryRef.current?.jettison();
    setArmedLeader(null);
    return true;
  }, []);

  const toggleCreateMenu = useCallback((viaLeader = false) => {
    const next = !createMenuOpenRef.current;
    createMenuOpenRef.current = next;
    setCreateMenuOpen(next);
    createMenuViaLeaderRef.current = next && viaLeader;
    setCreateMenuViaLeader(next && viaLeader);
    if (next) {
      setCommandMenuOpen(false);
      commandMenuOpenRef.current = false;
      if (viaLeader) registryRef.current?.activateLeader("c");
      else {
        registryRef.current?.jettison();
        registryRef.current?.setActive("launcher");
      }
    } else {
      registryRef.current?.jettison();
    }
    syncArmedLeader();
    return true;
  }, [syncArmedLeader]);

  const toggleCommandMenu = useCallback(() => {
    const next = !commandMenuOpenRef.current;
    commandMenuOpenRef.current = next;
    setCommandMenuOpen(next);
    if (next) {
      setCreateMenuOpen(false);
      setCreateMenuViaLeader(false);
      createMenuOpenRef.current = false;
      createMenuViaLeaderRef.current = false;
      resetPalette("all");
      registryRef.current?.jettison();
      setArmedLeader(null);
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
    setCreateMenuViaLeader(false);
    createMenuOpenRef.current = false;
    createMenuViaLeaderRef.current = false;
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
    setCreateMenuViaLeader(false);
    createMenuOpenRef.current = false;
    createMenuViaLeaderRef.current = false;
    registryRef.current?.jettison();
    setArmedLeader(null);
    return true;
  }, []);

  const selectableItems = useCallback(() => {
    if (createMenuOpenRef.current) return CREATE_MENU_ITEMS.filter((item) => !item.disabledReason);
    return filterCommandMenuItems(
      commandQueryRef.current,
      commandCategoryRef.current,
      commandScopeRef.current,
      userThemes,
    );
  }, [userThemes]);

  const moveCommandSelection = useCallback((delta: number) => {
    const items = selectableItems();
    if (items.length === 0) return true;
    const next = (commandSelectedIndexRef.current + delta + items.length) % items.length;
    commandSelectedIndexRef.current = next;
    setCommandSelectedIndex(next);
    return true;
  }, [selectableItems]);

  const confirmCommandSelection = useCallback((preferNewSplit = false) => {
    const items = selectableItems();
    const item = items[commandSelectedIndexRef.current] ?? items[0];
    if (item) selectCommandRef.current(item.id, preferNewSplit);
    return true;
  }, [selectableItems]);

  const cycleCommandCategory = useCallback((delta: number) => {
    if (!commandMenuOpenRef.current || commandScopeRef.current !== "root") return false;
    const next = nextCommandMenuCategory(commandCategoryRef.current, delta);
    setCommandCategory(next);
    commandCategoryRef.current = next;
    setCommandSelectedIndex(0);
    commandSelectedIndexRef.current = 0;
    return true;
  }, []);

  const openTaskCompose = useCallback((preferNewSplit = false) => {
    if (preferNewSplit) {
      const path = appendTaskSplitPath(boot.path);
      if (!path) return false;
      try {
        sessionStorage.setItem(OPEN_TASK_COMPOSE_KEY, "1");
      } catch {
        return false;
      }
      window.location.assign(path);
      return true;
    }
    if (!isTaskPath(boot.path)) {
      try {
        sessionStorage.setItem(OPEN_TASK_COMPOSE_KEY, "1");
      } catch {
        return false;
      }
      window.location.assign("/tasks");
      return true;
    }
    try {
      sessionStorage.removeItem(OPEN_TASK_COMPOSE_KEY);
    } catch {
      /* ignore */
    }
    setCreateMenuOpen(false);
    setCreateMenuViaLeader(false);
    createMenuOpenRef.current = false;
    createMenuViaLeaderRef.current = false;
    setCommandMenuOpen(false);
    commandMenuOpenRef.current = false;
    setTaskComposeOpen(true);
    taskComposeOpenRef.current = true;
    registryRef.current?.jettison();
    setArmedLeader(null);
    return true;
  }, [boot.path]);

  const updateSplitState = useCallback((update: (current: HydrateSplitState) => HydrateSplitState) => {
    const next = update(splitStateRef.current);
    splitStateRef.current = next;
    setSplitState(next);
  }, []);

  const closeTaskPopover = useCallback(() => {
    if (!taskComposeOpenRef.current) return false;
    taskComposeOpenRef.current = false;
    setTaskComposeOpen(false);
    return true;
  }, []);

  const applySurface = useCallback(async (live: TaskSessionApi) => {
    const surface = await loadTaskSurface(live);
    setItems(surfaceItems(surface.items));
    setActivity(surface.activity);
    setAlerts(surface.alerts);
  }, []);

  useEffect(() => {
    if (token) {
      if (isAuthCoverPath(boot.path)) window.location.assign(POST_AUTH_PATH);
      return;
    }
    if (!isAuthCoverPath(boot.path)) window.location.assign("/login");
  }, [boot.path, token]);

  useEffect(() => {
    if (!token || isAuthCoverPath(boot.path)) return;
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
    if (armedLeader !== "g" && armedLeader !== "o") return;
    const handle = window.setTimeout(() => {
      registryRef.current?.jettison();
      setArmedLeader(null);
    }, LEADER_HINT_RESET_MS);
    return () => window.clearTimeout(handle);
  }, [armedLeader]);

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
    registry.setActive(chromeActiveScope(boot.path, {
      commandMenuOpen,
      createMenuOpen,
      createMenuViaLeader,
    }));
    const navigate = (path: string) => {
      if (window.location.pathname + window.location.search !== path) window.location.assign(path);
    };
    const splitController = createHydrateSplitController({
      path: () => boot.path,
      navigate,
      getState: () => splitStateRef.current,
      setState: updateSplitState,
      history: window.history,
      closePopover: closeTaskPopover,
    });
    const handleChrome = defaultChromeHotkeyHandle(navigate, {
      currentPath: () => boot.path,
      enabled: () => {
        const splitCount = panesFromPath(boot.path).length;
        return defaultChromeContext({
          signedIn: Boolean(token),
          commandMenuOpen: commandMenuOpenRef.current,
          settingsOpen: boot.path === "/settings" || boot.path === "/mcp" || boot.path.startsWith("/settings"),
          settingsTabCount: 9,
          createMenuOpen: createMenuOpenRef.current,
          splitCount,
          canAppendSplit: splitCount < 8,
          leader: registry.leader,
          fullCoverRoute: isFullCoverRoute(boot.path),
          sidebarMounted: !isFullCoverRoute(boot.path),
          previewOpen: splitStateRef.current.previewOpen,
          drawerOpen: splitStateRef.current.drawerOpen,
        });
      },
      toggleCommandMenu,
      toggleCreateMenu: () => toggleCreateMenu(true),
      openTaskCompose,
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
      userThemes,
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
      focusHomeChat: () => {
        const input = document.querySelector<HTMLInputElement>(
          '[data-surface="ask"] input[data-command="home.focus-chat-input"]',
        );
        input?.focus();
        return Boolean(input);
      },
      ...splitController,
    });
    registerChromeHotkeys(registry, handleChrome);
    if (isTaskPath(boot.path) && !commandMenuOpen) {
      registerSliceHotkeys(registry, (id) =>
        handleLiveSliceHotkey(id, {
          openCreateMenu: () => toggleCreateMenu(true),
          openTaskCompose,
          openCommandCategory,
        }),
      );
    }
    const removeCapture = installHydrateCaptureHandler({
      registry,
      taskComposeOpen: () => taskComposeOpenRef.current,
      commandMenuOpen: () => commandMenuOpenRef.current,
      createMenuOpen: () => createMenuOpenRef.current,
      closeMenus,
      setArmedLeader,
    });
    return () => {
      removeCapture();
      if (registryRef.current === registry) registryRef.current = null;
    };
  }, [
    boot.authTokenKey,
    boot.path,
    boot.tenantKey,
    closeMenus,
    closeTaskPopover,
    commandMenuOpen,
    createMenuOpen,
    createMenuViaLeader,
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
    updateSplitState,
    userThemes,
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
      window.location.assign(POST_AUTH_PATH);
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
      const surface = await taskOperationsRef.current.run(
        { kind: "create", title },
        (operationId) => submitTaskCompose(session, title, operationId),
      );
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
      await taskOperationsRef.current.run({ kind: "done", entityId, done }, async (operationId) => {
        await session.markDone(entityId, done, operationId);
        await applySurface(session);
      });
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
      await taskOperationsRef.current.run({ kind: "title", entityId, title }, async (operationId) => {
        await session.updateTitle(entityId, title, operationId);
        await applySurface(session);
      });
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
      await taskOperationsRef.current.run({ kind: "status", entityId, status }, async (operationId) => {
        await session.setStatus(entityId, status, operationId);
        await applySurface(session);
      });
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
      const nextPriority = priority === "none" ? "none" : priority;
      await taskOperationsRef.current.run(
        { kind: "priority", entityId, priority: nextPriority },
        async (operationId) => {
          await session.setPriority(entityId, nextPriority, operationId);
          await applySurface(session);
        },
      );
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
      await taskOperationsRef.current.run(
        { kind: "assignee", entityId, assigneeId },
        async (operationId) => {
          await session.setAssignee(entityId, assigneeId, operationId);
          await applySurface(session);
        },
      );
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "assignee failed");
    }
  };

  const clickNavigate = (path: string) => window.location.assign(path);
  const clickSplitController = createHydrateSplitController({
    path: () => boot.path,
    navigate: clickNavigate,
    getState: () => splitStateRef.current,
    setState: updateSplitState,
    history: window.history,
    closePopover: closeTaskPopover,
  });

  const chromeClick = (id: string, preferNewSplit = false) => {
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
    if (
      id === "create-menu.task" ||
      id === "launcher.task" ||
      id === "launcher.task-new-split" ||
      (preferNewSplit && id === "go-to.tasks")
    ) {
      openTaskCompose(preferNewSplit || id === "launcher.task-new-split");
      return;
    }
    defaultChromeHotkeyHandle(
      (path) => window.location.assign(path),
      {
        currentPath: () => boot.path,
        enabled: () => {
          const splitCount = panesFromPath(boot.path).length;
          return defaultChromeContext({
            signedIn: Boolean(token),
            commandMenuOpen: commandMenuOpenRef.current,
            createMenuOpen: createMenuOpenRef.current,
            leader: registryRef.current?.leader ?? (createMenuOpenRef.current ? "c" : null),
            fullCoverRoute: isFullCoverRoute(boot.path),
            sidebarMounted: !isFullCoverRoute(boot.path),
            splitCount,
            canAppendSplit: splitCount < 8,
          });
        },
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
        userThemes,
        closeMenus,
        openTaskCompose,
        toggleCreateMenu: () => toggleCreateMenu(true),
        toggleCommandMenu,
        openCommandCategory,
        cycleCommandCategory,
        openCommandScope,
        backCommandScope,
        commandQueryEmpty: () => commandQueryRef.current.trim() === "",
        moveCommandSelection,
        confirmCommandSelection,
        focusHomeChat: () => {
          const input = document.querySelector<HTMLInputElement>(
            '[data-surface="ask"] input[data-command="home.focus-chat-input"]',
          );
          input?.focus();
          return Boolean(input);
        },
        ...clickSplitController,
      },
    )(id);
  };
  selectCommandRef.current = chromeClick;

  return createElement(Shell, {
    path: boot.path,
    theme,
    userThemes,
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
    focusedSplitIndex: splitState.focusedIndex,
    spotlightSplitIndex: splitState.spotlightIndex,
    previewOpen: splitState.previewOpen,
    drawerOpen: splitState.drawerOpen,
    armedLeader,
    onToggleCommandMenu: toggleCommandMenu,
    onToggleCreateMenu: () => toggleCreateMenu(false),
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
