// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import {
  CommandRegistry,
  CREATE_MENU_ITEMS,
  Shell,
  appendTaskSplitPath,
  chromeActiveScope,
  defaultChromeContext,
  defaultChromeHotkeyHandle,
  filterCommandMenuItems,
  registerChromeHotkeys,
} from "shell";
import {
  createHydrateSplitController,
  installHydrateCaptureHandler,
  type HydrateSplitState,
} from "./client-hydrate.js";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const cleanups: (() => void)[] = [];

afterEach(async () => {
  while (cleanups.length) cleanups.pop()?.();
  await act(async () => undefined);
  document.body.replaceChildren();
  localStorage.clear();
  sessionStorage.clear();
});

function key(
  target: Window | HTMLElement,
  code: string,
  keyValue: string,
  modifiers: Partial<Pick<KeyboardEventInit, "shiftKey" | "altKey" | "metaKey" | "ctrlKey">> = {},
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key: keyValue,
    code,
    bubbles: true,
    cancelable: true,
    ...modifiers,
  });
  target.dispatchEvent(event);
  return event;
}

function mount(render: (root: Root) => void): { root: Root; container: HTMLDivElement } {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => render(root));
  cleanups.push(() => root.unmount());
  return { root, container };
}

describe("integrated N5 hydrate runtime", () => {
  it("dispatches split commands through the capture handler into URL and component state", async () => {
    let path = "/home/_/tasks/_";
    let state: HydrateSplitState = {
      focusedIndex: 0,
      spotlightIndex: null,
      previewOpen: false,
      drawerOpen: true,
    };
    let popoverOpen = true;
    const navigations: string[] = [];
    const historyMoves: number[] = [];
    let renderUi: () => void = () => undefined;
    const { root, container } = mount((mountedRoot) => {
      renderUi = () => {
        mountedRoot.render(createElement(Shell, {
          path,
          taskComposeOpen: popoverOpen,
          focusedSplitIndex: state.focusedIndex,
          spotlightSplitIndex: state.spotlightIndex,
          previewOpen: state.previewOpen,
          drawerOpen: state.drawerOpen,
        }));
      };
      renderUi();
    });
    void root;
    const controller = createHydrateSplitController({
      path: () => path,
      navigate: (next) => {
        navigations.push(next);
        path = next;
      },
      getState: () => state,
      setState: (update) => {
        state = update(state);
        renderUi();
      },
      history: { length: 2, go: (delta?: number) => historyMoves.push(delta ?? 0) },
      closePopover: () => {
        if (!popoverOpen) return false;
        popoverOpen = false;
        renderUi();
        return true;
      },
    });
    const registry = new CommandRegistry();
    const handle = defaultChromeHotkeyHandle(() => undefined, {
      ...controller,
      enabled: () => defaultChromeContext({
        splitCount: 2,
        drawerOpen: state.drawerOpen,
        previewOpen: state.previewOpen,
      }),
    });
    registerChromeHotkeys(registry, handle);
    registry.setActive("split");
    const removeCapture = installHydrateCaptureHandler({
      registry,
      taskComposeOpen: () => popoverOpen,
      commandMenuOpen: () => false,
      createMenuOpen: () => false,
      closeMenus: () => false,
      setArmedLeader: () => undefined,
    });
    cleanups.push(removeCapture);

    act(() => key(window, "Escape", "Escape", { shiftKey: true }));
    expect(state.spotlightIndex).toBe(0);
    expect(container.querySelector('[data-split-index="1"]')?.hasAttribute("hidden")).toBe(true);

    act(() => key(window, "KeyL", "L", { shiftKey: true }));
    await Promise.resolve();
    expect(state.focusedIndex).toBe(1);
    expect(document.activeElement?.getAttribute("data-split-index")).toBe("1");

    act(() => key(window, "Space", " "));
    expect(state.previewOpen).toBe(true);
    expect(container.querySelector('[data-surface="split.preview"]')).not.toBeNull();

    act(() => key(window, "BracketLeft", "[", { altKey: true }));
    act(() => key(window, "BracketRight", "]", { altKey: true }));
    expect(historyMoves).toEqual([-1, 1]);

    act(() => key(window, "Escape", "Escape"));
    expect(state.drawerOpen).toBe(false);
    expect(container.querySelector('[data-surface="split.drawer"]')).toBeNull();

    registry.setActive("popover-split");
    act(() => key(window, "Escape", "Escape"));
    expect(popoverOpen).toBe(false);
    expect(container.querySelector('[data-scope="task-compose-popover"]')).toBeNull();

    registry.setActive("split");
    act(() => key(window, "Escape", "Escape", { metaKey: true }));
    expect(navigations.at(-1)).toBe("/");
  });

  it("uses launcher scope for mouse Create and preserves current/new task split behavior", () => {
    let path = "/";
    let createOpen = true;
    let composeOpen = false;
    let selected = 0;
    const navigations: string[] = [];
    const openTask = (preferNewSplit = false) => {
      if (preferNewSplit) {
        const next = appendTaskSplitPath(path);
        if (!next) return false;
        navigations.push(next);
        path = next;
      } else {
        composeOpen = true;
      }
      return true;
    };
    const build = (scope: "launcher" | "command-menu") => {
      const registry = new CommandRegistry();
      const handle = defaultChromeHotkeyHandle(() => undefined, {
        openTaskCompose: openTask,
        closeMenus: () => {
          createOpen = false;
          return true;
        },
        moveCommandSelection: (delta) => {
          const items = CREATE_MENU_ITEMS.filter((item) => !item.disabledReason);
          selected = (selected + delta + items.length) % items.length;
          return true;
        },
        confirmCommandSelection: (preferNewSplit) => {
          const items = scope === "launcher"
            ? CREATE_MENU_ITEMS.filter((item) => !item.disabledReason)
            : filterCommandMenuItems("", "tasks");
          const item = items[selected] ?? items[0];
          return item?.id === "create-menu.task" || item?.id === "launcher.task"
            ? openTask(Boolean(preferNewSplit))
            : false;
        },
        enabled: () => defaultChromeContext({ createMenuOpen: createOpen, commandMenuOpen: scope === "command-menu" }),
      });
      registerChromeHotkeys(registry, handle);
      registry.setActive(scope);
      const remove = installHydrateCaptureHandler({
        registry,
        taskComposeOpen: () => composeOpen,
        commandMenuOpen: () => scope === "command-menu",
        createMenuOpen: () => createOpen,
        closeMenus: () => {
          createOpen = false;
          return true;
        },
        setArmedLeader: () => undefined,
      });
      cleanups.push(remove);
      return { registry, remove };
    };

    expect(chromeActiveScope("/", { createMenuOpen: true, createMenuViaLeader: false })).toBe("launcher");
    const launcherRuntime = build("launcher");
    const launcher = launcherRuntime.registry;
    act(() => key(window, "ArrowDown", "ArrowDown"));
    expect(selected).toBe(0);
    act(() => key(window, "Enter", "Enter"));
    expect(composeOpen).toBe(true);
    expect(navigations).toEqual([]);

    composeOpen = false;
    launcher.setActive("launcher");
    act(() => key(window, "KeyT", "T", { shiftKey: true }));
    expect(navigations.at(-1)).toBe("/home/_/tasks/_");
    expect(composeOpen).toBe(false);
    createOpen = true;
    act(() => key(window, "KeyC", "c"));
    expect(createOpen).toBe(false);
    launcherRuntime.remove();

    path = "/";
    createOpen = true;
    const palette = build("command-menu").registry;
    selected = filterCommandMenuItems("", "tasks").findIndex((item) => item.id === "create-menu.task");
    palette.setActive("command-menu");
    act(() => key(window, "Enter", "Enter", { shiftKey: true }));
    expect(navigations.at(-1)).toBe("/home/_/tasks/_");

    path = "/tasks";
    expect(appendTaskSplitPath(path)).toBe("/tasks/_/tasks/_");
  });

  it("lets capture-phase Tab cycle categories, traps nested focus, restores focus, and backs on Escape", async () => {
    let open = false;
    let category: "all" | "commands" = "all";
    let scope: "root" | "change-theme" = "root";
    let selected = 0;
    let renderUi: () => void = () => undefined;
    const { container } = mount((root) => {
      renderUi = () => root.render(createElement(
        "div",
        null,
        createElement("button", { type: "button", id: "palette-opener" }, "Commands"),
        createElement(Shell, {
          path: "/tasks",
          commandMenuOpen: open,
          commandCategory: category,
          commandScope: scope,
          commandSelectedIndex: selected,
        }),
      ));
      renderUi();
    });
    const opener = container.querySelector<HTMLElement>("#palette-opener")!;
    opener.focus();
    open = true;
    act(renderUi);
    await Promise.resolve();
    const search = container.querySelector<HTMLInputElement>('[aria-label="Command search"]')!;
    expect(document.activeElement).toBe(search);

    const registry = new CommandRegistry();
    const handle = defaultChromeHotkeyHandle(() => undefined, {
      toggleCommandMenu: () => {
        open = !open;
        renderUi();
        return true;
      },
      cycleCommandCategory: (delta) => {
        if (scope !== "root") return false;
        category = delta > 0 ? "commands" : "all";
        selected = 0;
        renderUi();
        return true;
      },
      backCommandScope: () => {
        if (scope === "root") return false;
        scope = "root";
        renderUi();
        return true;
      },
      closeMenus: () => {
        open = false;
        renderUi();
        return true;
      },
      enabled: () => defaultChromeContext({ commandMenuOpen: open }),
    });
    registerChromeHotkeys(registry, handle);
    registry.setActive("command-menu");
    const removeCapture = installHydrateCaptureHandler({
      registry,
      taskComposeOpen: () => false,
      commandMenuOpen: () => open,
      createMenuOpen: () => false,
      closeMenus: () => {
        open = false;
        renderUi();
        return true;
      },
      setArmedLeader: () => undefined,
    });
    cleanups.push(removeCapture);

    let tab!: KeyboardEvent;
    act(() => {
      tab = key(search, "Tab", "Tab");
    });
    expect(tab.defaultPrevented).toBe(true);
    expect(category).toBe("commands");
    expect(document.activeElement).toBe(search);

    scope = "change-theme";
    act(renderUi);
    const nestedDialog = container.querySelector<HTMLElement>('[data-surface="command-menu"]')!;
    const nestedButtons = nestedDialog.querySelectorAll<HTMLButtonElement>("button:not([disabled])");
    const last = nestedButtons[nestedButtons.length - 1]!;
    last.focus();
    act(() => key(last, "Tab", "Tab"));
    expect(document.activeElement).toBe(nestedButtons[0]);

    const nestedSearch = container.querySelector<HTMLInputElement>('[aria-label="Command search"]')!;
    act(() => key(nestedSearch, "Escape", "Escape"));
    expect(scope).toBe("root");
    expect(open).toBe(true);
    act(() => key(container.querySelector<HTMLInputElement>('[aria-label="Command search"]')!, "Escape", "Escape"));
    await Promise.resolve();
    expect(open).toBe(false);
    expect(document.activeElement).toBe(opener);
  });
});
