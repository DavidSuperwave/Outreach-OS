import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { PATH_ROUTES, LAYOUT_ROUTE, ROUTES, isWebServed, wellKnownResponse, isFullCoverRoute } from "./routes.js";
import { ALWAYS_SPLITS, KILLED_DEV_SPLITS, decodeSplits, encodeSplits, SplitManager, isKilledSplit } from "./splits.js";
import { PATH_SPLIT, panesFromPath } from "./path-panes.js";
import { THEME_IDS, THEME_LABELS, STORAGE_KEYS, OKLCH_TOKENS, assertNoMacroBrand } from "./theme.js";
import { N5_COMMAND_IDS, commandEnabled, defaultChromeContext } from "./commands.js";
import { KERNEL_CONSUMED_RPC, KERNEL_RPC_TOTAL, KERNEL_UNCONSUMED_BY_SHELL } from "./kernel-surface.js";
import { CommandRegistry, chordFromEvent } from "./registry.js";
import { Shell } from "./Shell.js";
import {
  chromeActiveScope,
  chromeNavigatePath,
  registerChromeHotkeys,
  defaultChromeHotkeyHandle,
  COMMAND_MENU_ITEMS,
  CREATE_MENU_ITEMS,
  filterCommandMenuItems,
  SIDEBAR_NAV,
} from "./n5-hotkeys.js";
import { N5_KEYED_BINDINGS, N5_UNKEYED_IDS } from "./n5-ledger.js";

describe("27-route map", () => {
  it("freezes 26 path routes plus LAYOUT_ROUTE /*splits", () => {
    expect(PATH_ROUTES).toHaveLength(26);
    expect(LAYOUT_ROUTE).toBe("/*splits");
    expect(ROUTES).toHaveLength(27);
    expect(new Set(ROUTES).size).toBe(27);
  });

  it("serves nothing at /.well-known and skips desktop-auth on web (OD-9/OD-17)", () => {
    expect(wellKnownResponse()).toBeNull();
    expect(isWebServed("/.well-known")).toBe(false);
    expect(isWebServed("/.well-known/apple-app-site-association")).toBe(false);
    expect(isWebServed("/desktop-auth")).toBe(false);
    expect(isWebServed("/inbox")).toBe(true);
  });
});

describe("split engine + codec", () => {
  it("registers 28 always splits and refuses killed dev splits", () => {
    expect(ALWAYS_SPLITS).toHaveLength(28);
    expect(KILLED_DEV_SPLITS).toContain("hotkey-debugger");
    expect(isKilledSplit("hotkey-debugger")).toBe(true);
    expect(() => decodeSplits("/hotkey-debugger/_")).toThrow(/killed split/);
  });

  it("round-trips every always split type (05-MAP codec proof)", () => {
    for (const type of ALWAYS_SPLITS) {
      const path = encodeSplits([
        { type: "inbox", id: "_" },
        { type, id: "doc_00000000000000000000000000000001" },
      ]);
      expect(decodeSplits(path)).toEqual([
        { type: "inbox", id: "_" },
        { type, id: "doc_00000000000000000000000000000001" },
      ]);
    }
  });

  it("reload/share path is the layout; close last split returns home", () => {
    const manager = new SplitManager([{ type: "inbox", id: "_" }]);
    manager.append({ type: "md", id: "doc_1" });
    const shared = manager.toPath();
    expect(decodeSplits(shared)).toEqual(manager.panes);
    manager.closeFocused();
    manager.closeFocused();
    expect(manager.panes).toEqual([{ type: "home", id: "_" }]);
    manager.append({ type: "tasks", id: "_" });
    manager.back();
    expect(manager.panes[0]?.type).toBe("home");
  });
});

describe("OD-24 brand tripwire", () => {
  it("ships Outreach theme names and outreach-* storage keys, never macro-*", () => {
    expect(THEME_IDS).toContain("outreach-dark");
    expect(THEME_IDS).toContain("outreach-light");
    expect(THEME_LABELS["outreach-dark"]).toBe("Outreach Dark");
    expect(THEME_LABELS["outreach-light"]).toBe("Outreach Light");
    for (const id of THEME_IDS) assertNoMacroBrand(id);
    for (const label of Object.values(THEME_LABELS)) assertNoMacroBrand(label);
    for (const key of Object.values(STORAGE_KEYS)) {
      expect(key.startsWith("outreach-")).toBe(true);
      assertNoMacroBrand(key);
    }
    expect(OKLCH_TOKENS["outreach-dark"].surface.startsWith("oklch(")).toBe(true);
    expect(OKLCH_TOKENS["outreach-dark"].popover.startsWith("oklch(")).toBe(true);
    expect(N5_COMMAND_IDS.join("\n")).not.toMatch(/macro/i);
  });
});

describe("N5 chrome commands (160)", () => {
  it("freezes exactly 160 ledger identities", () => {
    expect(N5_COMMAND_IDS).toHaveLength(160);
    expect(new Set(N5_COMMAND_IDS).size).toBe(160);
  });

  it("every command is decidable; debugger is killed; c+t create-task is on", () => {
    const ctx = defaultChromeContext();
    for (const id of N5_COMMAND_IDS) {
      expect(typeof commandEnabled(id, ctx)).toBe("boolean");
    }
    expect(commandEnabled("global.hotkey-debugger", ctx)).toBe(false);
    expect(commandEnabled("create-menu.task", defaultChromeContext({ leader: "c" }))).toBe(true);
    expect(commandEnabled("create-menu.snippet", defaultChromeContext({ snippetsEnabled: false, leader: "c" }))).toBe(
      false,
    );
    expect(commandEnabled("go-to.getting-started", defaultChromeContext({ gettingStartedEnabled: false }))).toBe(false);
    expect(commandEnabled("settings.tab-9", defaultChromeContext({ settingsOpen: true, settingsTabCount: 3 }))).toBe(
      false,
    );
    expect(commandEnabled("global.toggle-sidebar", defaultChromeContext({ fullCoverRoute: true }))).toBe(false);
    expect(commandEnabled("global.create", defaultChromeContext({ touch: true }))).toBe(false);
  });

  it("covers every N5 id as keyed or unkeyed; debugger stays unkeyed/killed", () => {
    const keyedIds = new Set(N5_KEYED_BINDINGS.map((row) => row.id));
    expect(keyedIds.size + N5_UNKEYED_IDS.length).toBe(160);
    expect(new Set([...keyedIds, ...N5_UNKEYED_IDS]).size).toBe(160);
    expect(N5_UNKEYED_IDS).toContain("global.hotkey-debugger");
    expect(N5_UNKEYED_IDS).toContain("global.logout");
    expect(keyedIds.has("global.command-menu")).toBe(true);
    expect(chromeNavigatePath("go-to.tasks")).toBe("/tasks");
    expect(chromeNavigatePath("global.toggle-settings")).toBe("/settings");
    expect(chromeNavigatePath("settings.tab-2")).toBe("/mcp");
    expect(chromeActiveScope("/tasks")).toBe("split");
    expect(chromeActiveScope("/settings")).toBe("detached");
    expect(chromeActiveScope("/tasks", { commandMenuOpen: true })).toBe("detached");
    expect(chromeActiveScope("/tasks", { createMenuOpen: true })).toBe("command-scope-create-menu");
    expect(isFullCoverRoute("/login")).toBe(true);
    expect(isFullCoverRoute("/settings")).toBe(true);
    expect(isFullCoverRoute("/tasks")).toBe(false);
    expect(SIDEBAR_NAV.some((row) => row.id === "go-to.search")).toBe(false);
    expect(SIDEBAR_NAV.find((row) => row.id === "go-to.documents")?.label).toBe("Files");
  });

  it("registers keyed chrome chords; settings 1/2/3 stay off the soup split", () => {
    const registry = new CommandRegistry();
    const hits: string[] = [];
    registerChromeHotkeys(registry, (id) => {
      hits.push(id);
      return true;
    });
    const registered = new Set(registry.handlers().map((row) => row.id));
    const overrideSlot = new Map<string, string>();
    const expected = new Set<string>(["global.create", "global.go-to-leader", "global.open-category-leader"]);
    for (const row of N5_KEYED_BINDINGS) {
      if (row.id === "global.create" || row.id === "global.go-to-leader" || row.id === "global.open-category-leader") {
        continue;
      }
      if (row.registrationType === "add") expected.add(row.id);
      else overrideSlot.set(`${row.scope}\0${row.chord}`, row.id);
    }
    for (const id of overrideSlot.values()) expected.add(id);
    expect([...expected].filter((id) => !registered.has(id))).toEqual([]);
    expect(registered.has("global.hotkey-debugger")).toBe(false);
    registry.setActive("split");
    expect(registry.dispatch({ chord: "1", inputFocused: false, touch: false, platform: "mac" })).toBeNull();
    expect(registry.dispatch({ chord: "cmd+k", inputFocused: true, touch: false, platform: "mac" })).toBe(
      "global.command-menu",
    );
    expect(
      registry.dispatch({
        chord: chordFromEvent({
          key: ";",
          code: "Semicolon",
          altKey: false,
          shiftKey: false,
          metaKey: true,
          ctrlKey: false,
        }),
        inputFocused: false,
        touch: false,
        platform: "mac",
      }),
    ).toBe("global.toggle-settings");
    expect(registry.dispatch({ chord: "g", inputFocused: false, touch: false, platform: "mac" })).toBe(
      "global.go-to-leader",
    );
    expect(registry.dispatch({ chord: "t", inputFocused: false, touch: false, platform: "mac" })).toBe("go-to.tasks");
    expect(registry.dispatch({ chord: "/", inputFocused: false, touch: false, platform: "mac" })).toBe("go-to.search");
    expect(
      registry.dispatch({
        chord: chordFromEvent({
          key: ".",
          code: "Period",
          altKey: false,
          shiftKey: false,
          metaKey: true,
          ctrlKey: false,
        }),
        inputFocused: true,
        touch: false,
        platform: "mac",
      }),
    ).toBe("global.toggle-sidebar");
    registry.setActive("detached");
    expect(registry.dispatch({ chord: "1", inputFocused: false, touch: false, platform: "mac" })).toBe("settings.tab-1");
    expect(registry.dispatch({ chord: "2", inputFocused: false, touch: false, platform: "mac" })).toBe("settings.tab-2");
    expect(hits).toContain("global.command-menu");
    expect(COMMAND_MENU_ITEMS.some((item) => item.id === "go-to.tasks")).toBe(true);
  });
});

describe("kernel surface consumed", () => {
  it("documents 154 of 182 frozen RPC rows", () => {
    expect(KERNEL_CONSUMED_RPC).toHaveLength(154);
    expect(KERNEL_RPC_TOTAL).toBe(182);
    expect(KERNEL_UNCONSUMED_BY_SHELL).toBe(28);
    expect(KERNEL_CONSUMED_RPC).toContain("AuthenticatedApi.whoami");
    expect(KERNEL_CONSUMED_RPC).toContain("Overseer.subscribeToMetadata.callback");
    expect(KERNEL_CONSUMED_RPC.join("\n")).not.toMatch(/^PublicApi\./m);
    expect(KERNEL_CONSUMED_RPC.some((id) => id.startsWith("AdminApi."))).toBe(false);
    expect(KERNEL_CONSUMED_RPC).toContain("AuthenticatedApi.getAdminApi");
  });
});

describe("command registry scope tree", () => {
  it("walks split → global; soup cmd+k shadows global; cmd maps to ctrl; touch disables", () => {
    const registry = new CommandRegistry();
    const hits: string[] = [];
    registry.register({
      id: "global.command-menu",
      scope: "global",
      chord: "cmd+k",
      priority: 0,
      registrationType: "override",
      runWithInputFocused: true,
      handle: () => {
        hits.push("global");
        return true;
      },
    });
    registry.register({
      id: "soup.command-menu",
      scope: "split",
      chord: "cmd+k",
      priority: 10,
      registrationType: "override",
      runWithInputFocused: true,
      handle: () => {
        hits.push("soup");
        return true;
      },
    });
    registry.setActive("split");
    expect(registry.dispatch({ chord: "ctrl+k", inputFocused: false, touch: false, platform: "non-mac" })).toBe(
      "soup.command-menu",
    );
    expect(hits).toEqual(["soup"]);
    expect(registry.dispatch({ chord: "cmd+k", inputFocused: false, touch: true, platform: "mac" })).toBeNull();
  });

  it("h triple-booking: block remind-me runs first; false falls through to soup collapse (priority 4)", () => {
    const registry = new CommandRegistry();
    registry.setActive("block");
    registry.register({
      id: "soup-nav.collapse",
      scope: "split",
      chord: "h",
      priority: 4,
      registrationType: "add",
      runWithInputFocused: false,
      handle: () => true,
    });
    const remind = {
      id: "block-entity.remind-me",
      scope: "block" as const,
      chord: "h",
      priority: 0,
      registrationType: "add" as const,
      runWithInputFocused: false,
      handle: () => true,
    };
    registry.register(remind);
    expect(registry.dispatch({ chord: "h", inputFocused: false, touch: false, platform: "mac" })).toBe(
      "block-entity.remind-me",
    );
    registry.register({ ...remind, registrationType: "override", handle: () => false });
    expect(registry.dispatch({ chord: "h", inputFocused: false, touch: false, platform: "mac" })).toBe(
      "soup-nav.collapse",
    );
  });

  it("leaders g/o/c re-parent and jettison on unhandled keys; input-focus gate suppresses", () => {
    const registry = new CommandRegistry();
    registry.setActive("split");
    registry.activateLeader("c");
    expect(registry.activeScope).toBe("command-scope-create-menu");
    registry.register({
      id: "create-menu.task",
      scope: "command-scope-create-menu",
      chord: "t",
      priority: 0,
      registrationType: "override",
      runWithInputFocused: true,
      handle: () => true,
    });
    expect(registry.dispatch({ chord: "t", inputFocused: true, touch: false, platform: "mac" })).toBe(
      "create-menu.task",
    );
    registry.activateLeader("g");
    expect(registry.dispatch({ chord: "x", inputFocused: false, touch: false, platform: "mac" })).toBeNull();
    expect(registry.leader).toBeNull();
    registry.setActive("split");
    registry.register({
      id: "soup.filter",
      scope: "split",
      chord: "f",
      priority: 0,
      registrationType: "override",
      runWithInputFocused: false,
      handle: () => true,
    });
    expect(registry.dispatch({ chord: "f", inputFocused: true, touch: false, platform: "mac" })).toBeNull();
    expect(registry.dispatch({ chord: "f", inputFocused: false, touch: false, platform: "mac" })).toBe("soup.filter");
  });

  it("builds Neuwave modifier chords from KeyboardEvent (shift+cmd+s, shift+e, digits)", () => {
    expect(
      chordFromEvent({ key: "S", code: "KeyS", altKey: false, shiftKey: true, metaKey: true, ctrlKey: false }),
    ).toBe("shift+cmd+s");
    expect(
      chordFromEvent({ key: "s", code: "KeyS", altKey: false, shiftKey: true, metaKey: false, ctrlKey: true }),
    ).toBe("shift+ctrl+s");
    expect(
      chordFromEvent({ key: "E", code: "KeyE", altKey: false, shiftKey: true, metaKey: false, ctrlKey: false }),
    ).toBe("shift+e");
    expect(
      chordFromEvent({ key: "e", code: "KeyE", altKey: false, shiftKey: false, metaKey: false, ctrlKey: false }),
    ).toBe("e");
    expect(
      chordFromEvent({ key: "!", code: "Digit1", altKey: false, shiftKey: true, metaKey: false, ctrlKey: false }),
    ).toBe("shift+1");
    expect(
      chordFromEvent({ key: ";", code: "Semicolon", altKey: false, shiftKey: false, metaKey: true, ctrlKey: false }),
    ).toBe("cmd+;");
    expect(
      chordFromEvent({ key: ".", code: "Period", altKey: false, shiftKey: false, metaKey: true, ctrlKey: false }),
    ).toBe("cmd+.");
    expect(
      chordFromEvent({ key: "/", code: "Slash", altKey: false, shiftKey: false, metaKey: false, ctrlKey: false }),
    ).toBe("/");
    const registry = new CommandRegistry();
    registry.register({
      id: "soup-entity.status",
      scope: "global",
      chord: "shift+cmd+s",
      priority: 0,
      registrationType: "override",
      runWithInputFocused: false,
      handle: () => true,
    });
    const chord = chordFromEvent({
      key: "s",
      code: "KeyS",
      altKey: false,
      shiftKey: true,
      metaKey: true,
      ctrlKey: false,
    });
    expect(registry.dispatch({ chord, inputFocused: false, touch: false, platform: "mac" })).toBe(
      "soup-entity.status",
    );
  });
});

describe("path → split layout", () => {
  it("maps the 26 path routes onto always-splits or auth chrome", () => {
    expect(Object.keys(PATH_SPLIT)).toHaveLength(PATH_ROUTES.length);
    expect(panesFromPath("/tasks")).toEqual([{ type: "tasks", id: "_" }]);
    expect(panesFromPath("/settings?tab=bots")).toEqual([{ type: "settings", id: "_" }]);
    expect(panesFromPath("/login")).toEqual([{ type: "home", id: "_" }]);
    expect(panesFromPath("/tasks/_")).toEqual([{ type: "tasks", id: "_" }]);
    expect(panesFromPath("/hotkey-debugger/_")).toEqual([{ type: "home", id: "_" }]);
  });
});

describe("Shell boots", () => {
  it("renders original React chrome with Outreach tokens and a home split", () => {
    const html = renderToString(
      createElement(Shell, { path: "/", theme: "outreach-dark", panes: [{ type: "home", id: "_" }] }),
    );
    expect(html).toContain("data-shell=\"outreach-os\"");
    expect(html).toContain("Outreach OS");
    expect(html).toContain("data-split=\"home\"");
    expect(html).toContain("data-layout=\"app\"");
    expect(html).toContain("data-chrome=\"sidebar\"");
    expect(html).toContain("data-command=\"go-to.tasks\"");
    expect(html).toContain("data-command=\"global.toggle-sidebar\"");
    expect(html).not.toMatch(/macro/i);
    const blocked = renderToString(createElement(Shell, { path: "/.well-known" }));
    expect(blocked).toContain("data-unserved");
  });

  it("renders kernel login chrome on /login and /signup (PublicApi stays on /api)", () => {
    const login = renderToString(createElement(Shell, { path: "/login", theme: "outreach-dark" }));
    expect(login).toContain("data-surface=\"kernel.login\"");
    expect(login).toContain("data-mode=\"login\"");
    expect(login).toContain("data-mount=\"kernel-capnp\"");
    expect(login).toContain("aria-label=\"Username\"");
    expect(login).toContain("/api");
    expect(login).toContain("data-layout=\"full-cover\"");
    expect(login).not.toContain("data-chrome=\"sidebar\"");
    const signup = renderToString(createElement(Shell, { path: "/signup", theme: "outreach-dark" }));
    expect(signup).toContain("data-mode=\"signup\"");
    expect(signup).toContain("Create account");
    expect(signup).not.toMatch(/macro/i);
  });

  it("renders the task compose popover and Soup list on /tasks", () => {
    const html = renderToString(
      createElement(Shell, { path: "/tasks", theme: "outreach-dark" }),
    );
    expect(html).toContain("data-slice=\"task\"");
    expect(html).not.toContain("data-scope=\"task-compose-popover\"");
    expect(html).toContain("data-command=\"global.create\"");
    expect(html).toContain("data-surface=\"soup.tasks\"");
    expect(html).toContain("data-hint=\"create-menu.task\"");
    expect(html).toContain("data-command=\"soup.tab-1\"");
    expect(html).toContain("data-command=\"soup-nav.down-j\"");
    expect(html).toContain("data-command=\"global.command-menu\"");
    expect(html).toContain("data-command=\"go-to.tasks\"");
    expect(html).toContain("Customers");
    expect(html).not.toContain("data-nav=\"/search\"");
    expect(html).not.toContain("data-command=\"go-to.search\"");
    expect(html).not.toContain("data-command=\"go-to.markdown-documents\"");
    expect(html).toContain("data-empty=\"tasks\"");
    expect(html).toContain("aria-label=\"Tasks\"");
    expect(html).not.toMatch(/macro/i);
    const collapsed = renderToString(
      createElement(Shell, { path: "/tasks", theme: "outreach-dark", sidebarCollapsed: true }),
    );
    expect(collapsed).toContain("data-collapsed=\"true\"");
    expect(collapsed).toContain("aria-label=\"Expand sidebar\"");
    const compose = renderToString(
      createElement(Shell, { path: "/tasks", theme: "outreach-dark", taskComposeOpen: true }),
    );
    expect(compose).toContain("data-scope=\"task-compose-popover\"");
    expect(compose).toContain("aria-label=\"Task title\"");
    const denied = renderToString(
      createElement(Shell, { path: "/tasks", theme: "outreach-dark", kernelAuthError: "usr_1 lacks edit on doc_1" }),
    );
    expect(denied).toContain("data-permission=\"denied\"");
    const populated = renderToString(
      createElement(Shell, {
        path: "/tasks",
        theme: "outreach-dark",
        taskItems: [{ entityId: "doc_1", title: "Ship", facet: "task", done: false, status: "in_progress", priority: "high", assigneeIds: ["user_1"], tags: ["slice"] }],
      }),
    );
    expect(populated).toContain("Ship");
    expect(populated).toContain("aria-label=\"Status\"");
    expect(populated).toContain("aria-label=\"Priority\"");
    expect(populated).toContain("in_progress");
    expect(populated).toContain("high");
    expect(populated).toContain("aria-label=\"Tags\"");
    expect(populated).toContain("user_1");
    expect(populated).toContain("slice");
  });

  it("renders N10 settings connections, MCP harvest, and bots XOR copy", () => {
    const connections = renderToString(createElement(Shell, { path: "/settings", theme: "outreach-dark" }));
    expect(connections).toContain("data-command=\"settings.connections\"");
    expect(connections).toContain("data-vendor=\"instantly\"");
    expect(connections).toContain("reads only");
    expect(connections).toContain("GATEKEEPER_GITHUB");
    expect(connections).toContain("data-layout=\"full-cover\"");
    expect(connections).not.toContain("data-chrome=\"sidebar\"");
    expect(connections).toContain("data-command=\"settings.close\"");
    const mcp = renderToString(createElement(Shell, { path: "/mcp", theme: "outreach-dark" }));
    expect(mcp).toContain("data-command=\"settings.mcp\"");
    expect(mcp).toContain("authorization_code_pkce");
    expect(mcp).toContain("data-mcp-server=\"on\"");
    const bots = renderToString(createElement(Shell, { path: "/settings?tab=bots", theme: "outreach-dark" }));
    expect(bots).toContain("user XOR bot");
  });

  it("keeps /onboarding and /getting-started in the map as parked N19 chrome", () => {
    expect(PATH_ROUTES).toContain("/onboarding");
    expect(PATH_ROUTES).toContain("/getting-started");
    const onboarding = renderToString(createElement(Shell, { path: "/onboarding", panes: [{ type: "home", id: "_" }] }));
    expect(onboarding).toContain("data-surface=\"n19.parked\"");
    expect(onboarding).toContain("data-spec=\"needed\"");
    expect(onboarding).toContain("parked pending owner spec");
    expect(onboarding).not.toMatch(/tutorialComplete|user_onboarding/);
    expect(onboarding).not.toContain("<form");
    const started = renderToString(createElement(Shell, { path: "/getting-started", panes: [{ type: "home", id: "_" }] }));
    expect(started).toContain("data-surface=\"n19.parked\"");
  });

  it("renders the command menu overlay for cmd+k", () => {
    const html = renderToString(
      createElement(Shell, { path: "/tasks", theme: "outreach-dark", commandMenuOpen: true }),
    );
    expect(html).toContain("data-surface=\"command-menu\"");
    expect(html).toContain("aria-label=\"Command search\"");
    expect(html).toContain("data-command=\"command-menu.open-category.tasks\"");
    expect(html).toContain("data-command=\"go-to.tasks\"");
    expect(html).toContain("data-command=\"global.logout\"");
    expect(html).toContain("data-command=\"global.change-theme\"");
    expect(html).toContain("data-command-scope=\"root\"");
    expect(html).toContain("data-selected=\"true\"");
    expect(html).not.toMatch(/macro/i);
    const nested = renderToString(
      createElement(Shell, {
        path: "/tasks",
        theme: "outreach-dark",
        commandMenuOpen: true,
        commandScope: "change-theme",
      }),
    );
    expect(nested).toContain("data-command-scope=\"change-theme\"");
    expect(nested).toContain("data-command=\"theme.set-visible.outreach-dark\"");
    expect(nested).toContain("data-command=\"theme.system-preference\"");
    expect(nested).toContain("data-command=\"command-menu.backspace-back\"");
    expect(nested).not.toContain("data-command=\"global.logout\"");
    expect(nested).not.toContain("data-surface=\"command-menu.categories\"");
    const tasks = renderToString(
      createElement(Shell, {
        path: "/tasks",
        theme: "outreach-dark",
        commandMenuOpen: true,
        commandCategory: "tasks",
        commandQuery: "create",
      }),
    );
    expect(tasks).toContain("data-command=\"create-menu.task\"");
    expect(tasks).not.toContain("data-command=\"global.logout\"");
  });

  it("filters the palette and confirms the highlighted row without a hard /tasks jump", () => {
    expect(filterCommandMenuItems("", "tasks").map((item) => item.id)).toEqual(["go-to.tasks", "create-menu.task"]);
    expect(filterCommandMenuItems("create", "all").some((item) => item.id === "create-menu.task")).toBe(true);
    const paths: string[] = [];
    const hits: string[] = [];
    let selected = 0;
    let category = "all";
    const items = () => filterCommandMenuItems("", category === "tasks" ? "tasks" : "all");
    const registry = new CommandRegistry();
    registerChromeHotkeys(
      registry,
      defaultChromeHotkeyHandle((path) => paths.push(path), {
        toggleCommandMenu: () => true,
        openCommandCategory: (id) => {
          category = id.endsWith(".tasks") ? "tasks" : "all";
          selected = 0;
          return true;
        },
        moveCommandSelection: (delta) => {
          const list = items();
          selected = (selected + delta + list.length) % list.length;
          return true;
        },
        confirmCommandSelection: () => {
          hits.push(items()[selected]?.id ?? "");
          return true;
        },
        enabled: () => defaultChromeContext({ commandMenuOpen: true, signedIn: true }),
      }),
    );
    registry.setActive("split");
    expect(registry.dispatch({ chord: "o", inputFocused: false, touch: false, platform: "mac" })).toBe(
      "global.open-category-leader",
    );
    expect(registry.dispatch({ chord: "t", inputFocused: false, touch: false, platform: "mac" })).toBe(
      "command-menu.open-category.tasks",
    );
    expect(category).toBe("tasks");
    expect(paths).toEqual([]);
    registry.setActive("detached");
    expect(registry.dispatch({ chord: "arrowdown", inputFocused: true, touch: false, platform: "mac" })).toBe(
      "command-menu.nav-down",
    );
    expect(selected).toBe(1);
    expect(registry.dispatch({ chord: "enter", inputFocused: true, touch: false, platform: "mac" })).toBe(
      "command-menu.confirm",
    );
    expect(hits).toEqual(["create-menu.task"]);
    expect(paths).toEqual([]);
  });

  it("opens Change theme as a nested palette scope and Escape goes back", () => {
    expect(filterCommandMenuItems("", "all", "change-theme").map((item) => item.id)).toContain(
      "theme.set-visible.outreach-dark",
    );
    expect(filterCommandMenuItems("", "all", "change-theme").some((item) => item.id === "go-to.tasks")).toBe(false);
    const paths: string[] = [];
    const themes: string[] = [];
    let scope: "root" | "change-theme" = "root";
    let closed = false;
    const registry = new CommandRegistry();
    registerChromeHotkeys(
      registry,
      defaultChromeHotkeyHandle((path) => paths.push(path), {
        openCommandScope: (id) => {
          if (id === "global.change-theme") {
            scope = "change-theme";
            return true;
          }
          return false;
        },
        backCommandScope: () => {
          if (scope === "root") return false;
          scope = "root";
          return true;
        },
        applyTheme: (theme) => {
          themes.push(theme);
          return true;
        },
        closeMenus: () => {
          closed = true;
          scope = "root";
          return true;
        },
        enabled: () => defaultChromeContext({ commandMenuOpen: true, signedIn: true }),
      }),
    );
    registry.setActive("detached");
    expect(defaultChromeHotkeyHandle(() => undefined, {
      openCommandScope: (id) => {
        scope = id === "global.change-theme" ? "change-theme" : scope;
        return true;
      },
    })("global.change-theme")).toBe(true);
    expect(scope).toBe("change-theme");
    expect(paths).toEqual([]);
    expect(registry.dispatch({ chord: "escape", inputFocused: true, touch: false, platform: "mac" })).toBe(
      "command-menu.escape",
    );
    expect(scope).toBe("root");
    expect(closed).toBe(false);
    expect(
      defaultChromeHotkeyHandle(() => undefined, {
        applyTheme: (theme) => {
          themes.push(theme);
          return true;
        },
        closeMenus: () => {
          closed = true;
          return true;
        },
      })("theme.set-visible.outreach-light"),
    ).toBe(true);
    expect(themes).toEqual(["outreach-light"]);
    expect(closed).toBe(true);
    expect(paths).toEqual([]);
  });

  it("renders the create-menu overlay; c then t opens compose without navigating", () => {
    const html = renderToString(
      createElement(Shell, { path: "/tasks", theme: "outreach-dark", createMenuOpen: true }),
    );
    expect(html).toContain("data-surface=\"create-menu\"");
    expect(html).toContain("data-command=\"create-menu.task\"");
    expect(CREATE_MENU_ITEMS.some((item) => item.id === "create-menu.task")).toBe(true);
    const paths: string[] = [];
    let createOpen = false;
    let compose = false;
    const registry = new CommandRegistry();
    registerChromeHotkeys(
      registry,
      defaultChromeHotkeyHandle((path) => paths.push(path), {
        toggleCreateMenu: () => {
          createOpen = !createOpen;
          return true;
        },
        openTaskCompose: () => {
          compose = true;
          createOpen = false;
          return true;
        },
        closeMenus: () => {
          createOpen = false;
          return true;
        },
        enabled: () => defaultChromeContext({ leader: registry.leader, createMenuOpen: createOpen }),
      }),
    );
    registry.setActive("split");
    expect(registry.dispatch({ chord: "c", inputFocused: false, touch: false, platform: "mac" })).toBe(
      "global.create",
    );
    expect(createOpen).toBe(true);
    expect(registry.dispatch({ chord: "t", inputFocused: false, touch: false, platform: "mac" })).toBe(
      "create-menu.task",
    );
    expect(compose).toBe(true);
    expect(paths).toEqual([]);
  });
});
