// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { createElement } from "react";
import { Shell } from "./Shell.js";
import { N5_COMMAND_IDS } from "./n5-command-ids.js";
import {
  N5_COMMAND_COVERAGE,
  N5_COMMAND_COVERAGE_BY_ID,
  commandHasRuntime,
} from "./n5-command-coverage.js";
import { N5_KEYED_BINDINGS, N5_UNKEYED_IDS } from "./n5-ledger.js";
import {
  chromeNavigatePath,
  commandMenuItemsForScope,
  defaultChromeHotkeyHandle,
  persistTheme,
  registerChromeHotkeys,
} from "./n5-hotkeys.js";
import { defaultChromeContext } from "./commands.js";
import { CommandRegistry } from "./registry.js";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function effectHarness(currentPath = "/settings") {
  const effects: string[] = [];
  const handle = defaultChromeHotkeyHandle(
    (path) => effects.push(`navigate:${path}`),
    {
      currentPath,
      enabled: () =>
        defaultChromeContext({
          commandMenuOpen: true,
          createMenuOpen: true,
          settingsOpen: true,
          settingsTabCount: 9,
          splitCount: 2,
          drawerOpen: true,
          leader: "c",
        }),
      toggleCommandMenu: () => (effects.push("command-menu"), true),
      toggleCreateMenu: () => (effects.push("create-menu"), true),
      openTaskCompose: () => (effects.push("task-compose"), true),
      openCommandCategory: () => (effects.push("category"), true),
      cycleCommandCategory: (delta) => (effects.push(`category:${delta}`), true),
      moveCommandSelection: (delta) => (effects.push(`selection:${delta}`), true),
      confirmCommandSelection: (newSplit) => (effects.push(`confirm:${Boolean(newSplit)}`), true),
      closeMenus: () => (effects.push("close-menus"), true),
      openCommandScope: () => (effects.push("open-scope"), true),
      backCommandScope: () => (effects.push("back-scope"), true),
      commandQueryEmpty: () => true,
      applyTheme: (theme, kind) => (effects.push(`theme:${kind ?? "visible"}:${theme}`), true),
      logout: () => (effects.push("logout"), true),
      toggleSidebar: () => (effects.push("sidebar"), true),
      focusHomeChat: () => (effects.push("home-chat"), true),
      toggleAutoColorScheme: () => (effects.push("auto-theme"), true),
      closeSplit: () => (effects.push("split-close"), true),
      toggleSplitSpotlight: () => (effects.push("split-spotlight"), true),
      splitHistory: (delta) => (effects.push(`split-history:${delta}`), true),
      focusSplit: (delta) => (effects.push(`split-focus:${delta}`), true),
      toggleSplitPreview: () => (effects.push("split-preview"), true),
      closeSplitDrawer: () => (effects.push("split-drawer"), true),
      closePopoverSplit: () => (effects.push("popover-close"), true),
    },
  );
  return { effects, handle };
}

function expectedEffect(id: string, currentPath = "/settings"): string {
  if (id === "global.create") return "create-menu";
  if (id === "create-menu.task" || id === "launcher.task" || id === "launcher.task-new-split") return "task-compose";
  if (id === "global.command-menu") return "command-menu";
  if (id.startsWith("command-menu.open-category.")) return "category";
  if (id === "command-menu.next-category") return "category:1";
  if (id === "command-menu.prev-category") return "category:-1";
  if (id === "command-menu.nav-down" || id === "launcher.nav-down") return "selection:1";
  if (id === "command-menu.nav-up" || id === "launcher.nav-up") return "selection:-1";
  if (id === "command-menu.confirm" || id === "launcher.confirm") return "confirm:false";
  if (id === "command-menu.confirm-new-split" || id === "launcher.open-new-split") return "confirm:true";
  if (id === "command-menu.backspace-back" || id === "command-menu.escape") return "back-scope";
  if (["create-menu.close", "launcher.close-c", "launcher.exit"].includes(id)) return "close-menus";
  if (id === "global.toggle-sidebar") return "sidebar";
  if (id === "home.focus-chat-input") return "home-chat";
  if (id === "split.close-or-home") return "split-close";
  if (id === "split.spotlight") return "split-spotlight";
  if (id === "split.back") return "split-history:-1";
  if (id === "split.forward") return "split-history:1";
  if (id === "split.focus-right") return "split-focus:1";
  if (id === "split.focus-left") return "split-focus:-1";
  if (id === "split.toggle-preview") return "split-preview";
  if (id === "split.close-drawer") return "split-drawer";
  if (id === "popover-split.close") return "popover-close";
  const path = chromeNavigatePath(id, currentPath);
  if (path) return `navigate:${path}`;
  throw new Error(`No expected shell effect for ${id}`);
}

describe("generated N5 command acceptance", () => {
  it("gives every frozen row exactly one audited disposition", () => {
    expect(N5_COMMAND_COVERAGE).toHaveLength(160);
    expect(N5_COMMAND_COVERAGE.map((row) => row.id)).toEqual(N5_COMMAND_IDS);
    expect(new Set(N5_COMMAND_COVERAGE.map((row) => row.id)).size).toBe(160);
    expect(Object.fromEntries(
      ["functional", "command-menu-only", "downstream-gated", "owner-gated"].map((disposition) => [
        disposition,
        N5_COMMAND_COVERAGE.filter((row) => row.disposition === disposition).length,
      ]),
    )).toEqual({
      functional: 70,
      "command-menu-only": 50,
      "downstream-gated": 39,
      "owner-gated": 1,
    });
    expect(new Set([...N5_KEYED_BINDINGS.map((row) => row.id), ...N5_UNKEYED_IDS])).toEqual(
      new Set(N5_COMMAND_IDS),
    );
    for (const row of N5_COMMAND_COVERAGE) {
      expect(["functional", "command-menu-only", "downstream-gated", "owner-gated"]).toContain(
        row.disposition,
      );
      expect(row.reason.length).toBeGreaterThan(20);
    }
  });

  it("dispatches every in-scope keyed identity through CommandRegistry to its specified effect", () => {
    const keyed = new Map<string, (typeof N5_KEYED_BINDINGS)[number]>(
      N5_KEYED_BINDINGS.map((row) => [row.id, row]),
    );
    for (const coverage of N5_COMMAND_COVERAGE) {
      const row = keyed.get(coverage.id);
      if (!row || coverage.disposition !== "functional") continue;
      const registry = new CommandRegistry();
      const { effects, handle } = effectHarness();
      registerChromeHotkeys(registry, handle);
      registry.setActive(row.scope);
      const dispatched = registry.dispatch({
        chord: row.chord,
        inputFocused: false,
        touch: false,
        platform: "mac",
      });
      expect(dispatched, coverage.id).toBe(coverage.id);
      if (coverage.id === "global.go-to-leader") expect(registry.leader, coverage.id).toBe("g");
      else if (coverage.id === "global.open-category-leader") expect(registry.leader, coverage.id).toBe("o");
      else expect(effects, coverage.id).toContain(expectedEffect(coverage.id));
    }
  });

  it("does not register gated keyed rows and disables every gated identity", () => {
    const registry = new CommandRegistry();
    registerChromeHotkeys(registry, effectHarness().handle);
    const registered = new Set(registry.handlers().map((row) => row.id));
    for (const row of N5_COMMAND_COVERAGE) {
      if (row.disposition !== "downstream-gated" && row.disposition !== "owner-gated") continue;
      expect(effectHarness().handle.supports?.(row.id), row.id).toBe(false);
      expect(registered.has(row.id), row.id).toBe(false);
    }
  });

  it("executes command-menu-only commands or records them as structural scopes", () => {
    for (const id of N5_UNKEYED_IDS) {
      const coverage = N5_COMMAND_COVERAGE_BY_ID.get(id)!;
      if (
        coverage.disposition !== "command-menu-only" ||
        id.startsWith("scope.") ||
        id.includes("<user-theme>")
      ) continue;
      const { effects, handle } = effectHarness();
      expect(handle(id), id).toBe(true);
      expect(effects.length, id).toBeGreaterThan(0);
    }
    expect(commandHasRuntime("scope.command-scope-go-to")).toBe(true);
    expect(commandHasRuntime("theme.set-visible.<user-theme>")).toBe(true);
    expect(N5_COMMAND_COVERAGE_BY_ID.get("scope.command-scope-go-to")?.reason).toMatch(/Structural/);
  });

  it("materializes and executes all three dynamic user-theme marker rows", () => {
    const userThemes = [{
      id: "sunset",
      label: "Sunset",
      tokens: {
        surface: "oklch(0.2 0.1 20)",
        text: "oklch(0.9 0.1 20)",
        border: "oklch(0.4 0.1 20)",
        accent: "oklch(0.7 0.2 20)",
        status: "oklch(0.7 0.2 140)",
        muted: "oklch(0.6 0.1 20)",
        overlay: "oklch(0.1 0.1 20 / 0.7)",
        popover: "oklch(0.3 0.1 20)",
      },
    }] as const;
    expect(commandMenuItemsForScope("change-theme", userThemes).map((item) => item.id)).toContain(
      "theme.set-visible.sunset",
    );
    expect(commandMenuItemsForScope("default-light", userThemes).map((item) => item.id)).toContain(
      "theme.default-light.sunset",
    );
    expect(commandMenuItemsForScope("default-dark", userThemes).map((item) => item.id)).toContain(
      "theme.default-dark.sunset",
    );
    const applied: string[] = [];
    const handle = defaultChromeHotkeyHandle(() => undefined, {
      userThemes,
      applyTheme: (theme, kind = "visible") => {
        persistTheme(theme, kind);
        applied.push(`${kind}:${theme}`);
        return true;
      },
      closeMenus: () => true,
    });
    expect(handle("theme.set-visible.sunset")).toBe(true);
    expect(handle("theme.default-light.sunset")).toBe(true);
    expect(handle("theme.default-dark.sunset")).toBe(true);
    expect(applied).toEqual(["visible:sunset", "light:sunset", "dark:sunset"]);
    expect(localStorage.getItem("outreach-theme")).toBe("sunset");
    expect(localStorage.getItem("outreach-default-light")).toBe("sunset");
    expect(localStorage.getItem("outreach-default-dark")).toBe("sunset");
  });
});

describe("command palette accessibility", () => {
  it("focuses search, traps focus, exposes modal semantics, and restores the opener", () => {
    const view = render(
      createElement(
        "div",
        null,
        createElement("button", { type: "button", "data-testid": "opener" }, "Open commands"),
        createElement(Shell, { path: "/tasks", commandMenuOpen: false }),
      ),
    );
    const opener = view.getByTestId("opener");
    opener.focus();
    view.rerender(
      createElement(
        "div",
        null,
        createElement("button", { type: "button", "data-testid": "opener" }, "Open commands"),
        createElement(Shell, { path: "/tasks", commandMenuOpen: true }),
      ),
    );
    const dialog = view.getByRole("dialog", { name: "Command menu" });
    const search = view.getByRole("textbox", { name: "Command search" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(search);
    expect(dialog.querySelector('[role="group"][aria-label="Command results"]')).not.toBeNull();
    expect(dialog.querySelector('button[aria-current="true"]')).not.toBeNull();

    const focusable = dialog.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled])");
    const last = focusable[focusable.length - 1]!;
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(search);
    fireEvent.keyDown(search, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);

    view.rerender(
      createElement(
        "div",
        null,
        createElement("button", { type: "button", "data-testid": "opener" }, "Open commands"),
        createElement(Shell, { path: "/tasks", commandMenuOpen: false }),
      ),
    );
    expect(document.activeElement).toBe(view.getByTestId("opener"));
  });
});
