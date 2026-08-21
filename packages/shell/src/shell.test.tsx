import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { PATH_ROUTES, LAYOUT_ROUTE, ROUTES, isWebServed, wellKnownResponse } from "./routes.js";
import { ALWAYS_SPLITS, KILLED_DEV_SPLITS, decodeSplits, encodeSplits, SplitManager, isKilledSplit } from "./splits.js";
import { THEME_IDS, THEME_LABELS, STORAGE_KEYS, OKLCH_TOKENS, assertNoMacroBrand } from "./theme.js";
import { N5_COMMAND_IDS, commandEnabled, defaultChromeContext } from "./commands.js";
import { KERNEL_CONSUMED_RPC, KERNEL_RPC_TOTAL, KERNEL_UNCONSUMED_BY_SHELL } from "./kernel-surface.js";
import { CommandRegistry } from "./registry.js";
import { Shell } from "./Shell.js";

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
});

describe("Shell boots", () => {
  it("renders original React chrome with Outreach tokens and a home split", () => {
    const html = renderToString(
      createElement(Shell, { path: "/", theme: "outreach-dark", panes: [{ type: "home", id: "_" }] }),
    );
    expect(html).toContain("data-shell=\"outreach-os\"");
    expect(html).toContain("Outreach OS");
    expect(html).toContain("data-split=\"home\"");
    expect(html).not.toMatch(/macro/i);
    const blocked = renderToString(createElement(Shell, { path: "/.well-known" }));
    expect(blocked).toContain("data-unserved");
  });

  it("renders N10 settings connections, MCP harvest, and bots XOR copy", () => {
    const connections = renderToString(createElement(Shell, { path: "/settings", theme: "outreach-dark" }));
    expect(connections).toContain("data-command=\"settings.connections\"");
    expect(connections).toContain("data-vendor=\"instantly\"");
    expect(connections).toContain("reads only");
    expect(connections).toContain("GATEKEEPER_GITHUB");
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
});
