import { N5_COMMAND_IDS, type N5CommandId } from "./n5-command-ids.js";

export type N5CommandDisposition =
  | "functional"
  | "command-menu-only"
  | "downstream-gated"
  | "owner-gated";

export interface N5CommandCoverage {
  id: N5CommandId;
  disposition: N5CommandDisposition;
  reason: string;
}

const OWNER_GATED = new Map<N5CommandId, string>([
  [
    "global.hotkey-debugger",
    "OD-23(b) remains unruled; the LOCAL_ONLY debugger is killed in the web shell.",
  ],
]);

const DOWNSTREAM_GATED = new Map<N5CommandId, string>([
  ["create-menu.email", "N11 owns email compose."],
  ["create-menu.chat", "N10 owns agent-chat creation."],
  ["create-menu.automation", "N10 owns automation compose."],
  ["create-menu.skill", "N10 owns skill compose."],
  ["create-menu.md", "N7 owns document creation."],
  ["create-menu.snippet", "N7 owns snippet creation and its feature flag."],
  ["create-menu.channel-message", "N9 owns channel-message compose."],
  ["create-menu.channel", "N9 owns channel creation."],
  ["create-menu.canvas", "N7 owns canvas creation."],
  ["create-menu.project", "N7 owns folder creation."],
  ["create-menu.code", "N7 owns code-document creation."],
  ["global.instructions", "N7 owns the instructions document."],
  ["global.upload-files", "N14 owns the upload pipeline and picker."],
  ["global.upload-folders", "N14 owns folder walking and upload."],
  ["global.undo", "Domain mutation history is not available at the N5 boundary."],
  ["global.redo", "Domain mutation history is not available at the N5 boundary."],
  ["launcher.email", "N11 owns email compose."],
  ["launcher.email-new-split", "N11 owns email compose."],
  ["launcher.chat", "N10 owns agent-chat creation."],
  ["launcher.chat-new-split", "N10 owns agent-chat creation."],
  ["launcher.automation", "N10 owns automation compose."],
  ["launcher.skill", "N10 owns skill compose."],
  ["launcher.md", "N7 owns document creation."],
  ["launcher.md-new-split", "N7 owns document creation."],
  ["launcher.snippet", "N7 owns snippet creation."],
  ["launcher.snippet-new-split", "N7 owns snippet creation."],
  ["launcher.channel-message", "N9 owns channel-message compose."],
  ["launcher.channel-new-split-message", "N9 owns channel-message compose."],
  ["launcher.channel", "N9 owns channel creation."],
  ["launcher.canvas", "N7 owns canvas creation."],
  ["launcher.canvas-new-split", "N7 owns canvas creation."],
  ["launcher.project", "N7 owns folder creation."],
  ["launcher.project-new-split", "N7 owns folder creation."],
  ["launcher.code", "N7 owns code-document creation."],
  ["launcher.code-new-split", "N7 owns code-document creation."],
  ["scope.favorites", "N17 owns favorites data and its dynamic command scope."],
  ["global.favorites", "N17 owns favorites data and its dynamic command scope."],
  ["global.invite-team", "N1 owns invitation mutation and authorization."],
  ["block.share", "N2 owns share receipts and the share dialog authority."],
]);

const COMMAND_MENU_ONLY = new Set<N5CommandId>([
  "global.account",
  "global.logout",
  "global.mcp-setup",
  "global.change-theme",
  "theme.system-preference",
  "theme.set-visible.outreach-dark",
  "theme.set-visible.void",
  "theme.set-visible.ember",
  "theme.set-visible.spirit",
  "theme.set-visible.moon",
  "theme.set-visible.rain",
  "theme.set-visible.outreach-light",
  "theme.set-visible.satsuma",
  "theme.set-visible.lapis",
  "theme.set-visible.flora",
  "theme.set-visible.paper",
  "theme.set-visible.decepticon",
  "theme.set-visible.<user-theme>",
  "global.set-default-light-theme",
  "theme.default-light.outreach-dark",
  "theme.default-light.void",
  "theme.default-light.ember",
  "theme.default-light.spirit",
  "theme.default-light.moon",
  "theme.default-light.rain",
  "theme.default-light.outreach-light",
  "theme.default-light.satsuma",
  "theme.default-light.lapis",
  "theme.default-light.flora",
  "theme.default-light.paper",
  "theme.default-light.decepticon",
  "theme.default-light.<user-theme>",
  "global.set-default-dark-theme",
  "theme.default-dark.outreach-dark",
  "theme.default-dark.void",
  "theme.default-dark.ember",
  "theme.default-dark.spirit",
  "theme.default-dark.moon",
  "theme.default-dark.rain",
  "theme.default-dark.outreach-light",
  "theme.default-dark.satsuma",
  "theme.default-dark.lapis",
  "theme.default-dark.flora",
  "theme.default-dark.paper",
  "theme.default-dark.decepticon",
  "theme.default-dark.<user-theme>",
  "global.auto-detect-color-scheme",
  "scope.command-scope-go-to",
  "scope.command-scope-command-menu-category",
  "scope.command-scope-create-menu",
]);

const FUNCTIONAL = new Map<N5CommandId, string>();

function functional(ids: readonly N5CommandId[], reason: string): void {
  for (const id of ids) {
    if (FUNCTIONAL.has(id)) throw new Error(`Duplicate functional N5 classification: ${id}`);
    FUNCTIONAL.set(id, reason);
  }
}

functional(
  ["global.create", "create-menu.task", "create-menu.close"],
  "N5/N6 create runtime opens/closes the ruled launcher or task compose surface.",
);
functional(
  [
    "global.command-menu",
    "global.open-category-leader",
    "command-menu.open-category.all",
    "command-menu.open-category.commands",
    "command-menu.open-category.chats",
    "command-menu.open-category.documents",
    "command-menu.open-category.tasks",
    "command-menu.open-category.channels",
    "command-menu.open-category.dms",
  ],
  "N5 command-menu runtime opens the dialog or changes its concrete category state.",
);
functional(
  ["global.new-split.cmd", "global.new-split.bare", "global.toggle-settings"],
  "N5 route/split runtime produces a concrete URL transition through the route codec.",
);
functional(
  [
    "launcher.task",
    "launcher.task-new-split",
    "launcher.close-c",
    "launcher.nav-up",
    "launcher.nav-down",
    "launcher.exit",
    "launcher.open-new-split",
    "launcher.confirm",
  ],
  "N5 launcher runtime changes selection, closes, confirms, or opens task compose with split preference.",
);
functional(
  [
    "command-menu.nav-down",
    "command-menu.nav-up",
    "command-menu.confirm",
    "command-menu.confirm-new-split",
    "command-menu.escape",
    "command-menu.backspace-back",
    "command-menu.next-category",
    "command-menu.prev-category",
  ],
  "N5 command-menu runtime changes selection/category/scope or confirms the selected command.",
);
functional(
  [
    "global.toggle-sidebar",
    "global.go-to-leader",
    "go-to.home",
    "go-to.getting-started",
    "go-to.inbox",
    "go-to.activity",
    "go-to.reminders",
    "go-to.search",
    "go-to.agents",
    "go-to.mail",
    "go-to.documents",
    "go-to.markdown-documents",
    "go-to.tasks",
    "go-to.calendar",
    "go-to.channels",
    "go-to.calls",
    "go-to.companies",
  ],
  "N5 chrome runtime changes sidebar state, leader scope, or the active route.",
);
functional(
  [
    "split.close-or-home",
    "split.spotlight",
    "split.back",
    "split.forward",
    "split.focus-right",
    "split.focus-left",
    "popover-split.close",
    "split.toggle-preview",
    "split.close-drawer",
    "home.focus-chat-input",
  ],
  "N5 hydrate runtime changes actual split URL/history/focus/spotlight/preview/drawer/popover or DOM focus state.",
);
functional(
  [
    "settings.close",
    "settings.next-tab",
    "settings.prev-tab",
    "settings.tab-1",
    "settings.tab-2",
    "settings.tab-3",
    "settings.tab-4",
    "settings.tab-5",
    "settings.tab-6",
    "settings.tab-7",
    "settings.tab-8",
    "settings.tab-9",
  ],
  "N5 settings runtime transitions among the nine commandable settings routes.",
);

function coverageFor(id: N5CommandId): N5CommandCoverage {
  const ownerReason = OWNER_GATED.get(id);
  if (ownerReason) return { id, disposition: "owner-gated", reason: ownerReason };
  const downstreamReason = DOWNSTREAM_GATED.get(id);
  if (downstreamReason) return { id, disposition: "downstream-gated", reason: downstreamReason };
  if (COMMAND_MENU_ONLY.has(id)) {
    return {
      id,
      disposition: "command-menu-only",
      reason: id.startsWith("scope.")
        ? "Structural scope-registration row; it has no keyboard handler."
        : id.includes("<user-theme>")
          ? "Runtime marker; executable child commands are generated from Outreach user themes in local storage."
        : "The ledger intentionally assigns no chord; dispatch is available from the command menu.",
    };
  }
  const functionalReason = FUNCTIONAL.get(id);
  if (functionalReason) return { id, disposition: "functional", reason: functionalReason };
  throw new Error(`Unclassified N5 command row: ${id}`);
}

/** Generated one-for-one from the frozen 160-id N5 registry/chrome set. */
export const N5_COMMAND_COVERAGE = N5_COMMAND_IDS.map(coverageFor);

export const N5_COMMAND_COVERAGE_BY_ID = new Map(
  N5_COMMAND_COVERAGE.map((row) => [row.id, row] as const),
);

export function commandDisposition(id: N5CommandId): N5CommandDisposition {
  return N5_COMMAND_COVERAGE_BY_ID.get(id)!.disposition;
}

export function commandHasRuntime(id: N5CommandId): boolean {
  const disposition = commandDisposition(id);
  return disposition === "functional" || disposition === "command-menu-only";
}
