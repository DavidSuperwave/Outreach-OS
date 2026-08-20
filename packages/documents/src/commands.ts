/**
 * N7 command freeze is 71 editor rows (canvas 37 + md 32 + code 2; 05-GRAPH §N7).
 * Enablement for the editor set ships with viewers; this package names the freeze
 * and exercises the lifecycle parity set (create / edit / move / restore).
 */
export const DOCUMENT_COMMAND_FREEZE_COUNT = 71;
export const DOCUMENT_COMMAND_FREEZE = { canvas: 37, md: 32, code: 2 } as const;

/** Full 71-row freeze, harvested from CMD-L `canvas.*` / `md.*` / `code.*`. */
export const DOCUMENT_COMMAND_IDS = [
  "canvas.delete",
  "canvas.bring-to-front",
  "canvas.bring-forward",
  "canvas.send-to-back",
  "canvas.send-backward",
  "canvas.select-all",
  "canvas.copy",
  "canvas.cut",
  "canvas.paste",
  "canvas.zoom-in",
  "canvas.zoom-out",
  "canvas.undo",
  "canvas.redo",
  "canvas.cancel",
  "canvas.tool-select",
  "canvas.tool-hand",
  "canvas.tool-shape",
  "canvas.tool-pencil",
  "canvas.tool-line",
  "canvas.tool-text",
  "canvas.tool-zoom-in",
  "canvas.tool-zoom-out",
  "canvas.nudge-up",
  "canvas.nudge-up-more",
  "canvas.nudge-right",
  "canvas.nudge-right-more",
  "canvas.nudge-down",
  "canvas.nudge-down-more",
  "canvas.nudge-left",
  "canvas.nudge-left-more",
  "canvas.group",
  "canvas.ungroup",
  "canvas.opt-zoom-flip",
  "canvas.space-grab",
  "canvas.connector-straight",
  "canvas.connector-flow",
  "canvas.connector-bent",
  "md.compose-skill.create",
  "md.compose-task.create",
  "md.find",
  "md.history.next-version",
  "md.history.previous-version",
  "md.focus-editor",
  "md.copy-branch-name",
  "md.toggle-side-panel",
  "md.format.bold",
  "md.format.italic",
  "md.format.underline",
  "md.format.strikethrough",
  "md.format.highlight",
  "md.format.inline-code",
  "md.format.superscript",
  "md.format.subscript",
  "md.insert.paragraph",
  "md.insert.heading1",
  "md.insert.heading2",
  "md.insert.heading3",
  "md.insert.quote",
  "md.insert.code-block",
  "md.insert.bullet-list",
  "md.insert.numbered-list",
  "md.insert.checklist",
  "md.insert.image",
  "md.insert.video",
  "md.insert.link",
  "md.insert.math",
  "md.insert.table",
  "md.insert.divider",
  "md.toggle-state-debugger",
  "code.toggle-comment",
  "code.escape",
] as const;

export type DocumentCommandId = (typeof DOCUMENT_COMMAND_IDS)[number];

/**
 * Lifecycle parity identities exercised end-to-end by N7 (05-MAP row 5).
 * `document.edit` / `document.move` / `document.restore` are domain ids;
 * chrome create-menu rows live on N5.
 */
export const N7_PARITY_COMMAND_IDS = [
  "create-menu.md",
  "create-menu.project",
  "create-menu.canvas",
  "create-menu.code",
  "go-to.documents",
  "document.edit",
  "document.move",
  "document.restore",
  "soup-entity.rename",
  "soup-entity.move-to-folder",
] as const;

export type N7ParityCommandId = (typeof N7_PARITY_COMMAND_IDS)[number];
