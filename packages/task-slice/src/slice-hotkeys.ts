import type { CommandRegistry, LeaderKey, RegistrationType, ScopeId } from "shell";

/** Ledger chords for the 15 N6 identities (03-command-hotkey-ledger.csv). */
export const SLICE_HOTKEY_BINDINGS: readonly {
  id: string;
  scope: ScopeId;
  chord: string;
  runWithInputFocused: boolean;
  registrationType: RegistrationType;
}[] = [
  { id: "global.create", scope: "global", chord: "c", runWithInputFocused: false, registrationType: "override" },
  {
    id: "create-menu.task",
    scope: "command-scope-create-menu",
    chord: "t",
    runWithInputFocused: true,
    registrationType: "override",
  },
  { id: "launcher.task", scope: "detached", chord: "t", runWithInputFocused: false, registrationType: "override" },
  {
    id: "command-menu.open-category.tasks",
    scope: "command-scope-command-menu-category",
    chord: "t",
    runWithInputFocused: true,
    registrationType: "override",
  },
  { id: "go-to.tasks", scope: "command-scope-go-to", chord: "t", runWithInputFocused: false, registrationType: "override" },
  { id: "soup.tab-1", scope: "split", chord: "1", runWithInputFocused: false, registrationType: "override" },
  { id: "soup.open", scope: "split", chord: "enter", runWithInputFocused: false, registrationType: "override" },
  { id: "soup-entity.mark-done", scope: "global", chord: "e", runWithInputFocused: false, registrationType: "add" },
  {
    id: "soup-entity.mark-not-done",
    scope: "global",
    chord: "shift+e",
    runWithInputFocused: false,
    registrationType: "add",
  },
  { id: "soup-entity.rename", scope: "global", chord: "r", runWithInputFocused: false, registrationType: "add" },
  {
    id: "soup-entity.properties",
    scope: "global",
    chord: "shift+cmd+o",
    runWithInputFocused: false,
    registrationType: "override",
  },
  { id: "soup-entity.tags", scope: "split", chord: "t", runWithInputFocused: false, registrationType: "override" },
  {
    id: "soup-entity.priority",
    scope: "global",
    chord: "shift+cmd+p",
    runWithInputFocused: false,
    registrationType: "override",
  },
  {
    id: "soup-entity.assignee",
    scope: "global",
    chord: "shift+cmd+a",
    runWithInputFocused: false,
    registrationType: "override",
  },
  {
    id: "soup-entity.status",
    scope: "global",
    chord: "shift+cmd+s",
    runWithInputFocused: false,
    registrationType: "override",
  },
];

const EXTRA_TABS = [
  { id: "soup.tab-2", chord: "2" },
  { id: "soup.tab-3", chord: "3" },
] as const;

const SOUP_NAV = [
  { id: "soup-nav.down-j", chord: "j" },
  { id: "soup-nav.down-arrow", chord: "arrowdown" },
  { id: "soup-nav.up-k", chord: "k" },
  { id: "soup-nav.up-arrow", chord: "arrowup" },
] as const;

const LEADERS: readonly { id: string; leader: LeaderKey; chord: LeaderKey }[] = [
  { id: "global.create", leader: "c", chord: "c" },
  { id: "global.go-to", leader: "g", chord: "g" },
  { id: "global.open-category-leader", leader: "o", chord: "o" },
];

/**
 * Register the 15 slice identities (plus g/o leaders and soup tabs 2/3) on a
 * CommandRegistry. `handle` returns whether the chord was consumed.
 */
export function registerSliceHotkeys(
  registry: CommandRegistry,
  handle: (id: string) => boolean,
): void {
  for (const row of LEADERS) {
    registry.register({
      id: row.id,
      scope: "global",
      chord: row.chord,
      priority: 0,
      registrationType: "override",
      runWithInputFocused: false,
      handle: () => {
        registry.activateLeader(row.leader);
        handle(row.id);
        return true;
      },
    });
  }
  for (const row of SLICE_HOTKEY_BINDINGS) {
    if (row.id === "global.create") continue;
    registry.register({
      id: row.id,
      scope: row.scope,
      chord: row.chord,
      priority: 0,
      registrationType: row.registrationType,
      runWithInputFocused: row.runWithInputFocused,
      handle: () => handle(row.id),
    });
  }
  for (const tab of EXTRA_TABS) {
    registry.register({
      id: tab.id,
      scope: "split",
      chord: tab.chord,
      priority: 0,
      registrationType: "override",
      runWithInputFocused: false,
      handle: () => handle(tab.id),
    });
  }
  for (const nav of SOUP_NAV) {
    registry.register({
      id: nav.id,
      scope: "split",
      chord: nav.chord,
      priority: 0,
      registrationType: "override",
      runWithInputFocused: false,
      handle: () => handle(nav.id),
    });
  }
}
