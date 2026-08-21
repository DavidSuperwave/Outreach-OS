#!/usr/bin/env node
/**
 * Freeze keyed N5 chrome rows from 03-command-hotkey-ledger.csv into n5-ledger.ts.
 * Unkeyed "(none…)" / scope-registration rows are listed but not bound to chords.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const csvPath = join(root, "docs/neuwave-rewrite/reports/03-command-hotkey-ledger.csv");
const outPath = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "n5-ledger.ts");

const N5_IDS = new Set(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "src", "n5-command-ids.ts"), "utf8")
    .match(/"[^"]+"/g)
    .map((token) => token.slice(1, -1))
    .filter((id) => id.includes(".") || id.includes("<")),
);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

function remapId(id) {
  return id.replaceAll("macro-dark", "outreach-dark").replaceAll("macro-light", "outreach-light");
}

function mapScope(id, csvScope) {
  if (id.startsWith("settings.")) return "detached";
  if (id.startsWith("launcher.")) return "detached";
  if (id === "popover-split.close") return "detached";
  if (id.startsWith("command-menu.open-category.")) return "command-scope-command-menu-category";
  if (id.startsWith("command-menu.")) return "detached";
  if (id.startsWith("create-menu.")) return "command-scope-create-menu";
  if (id.startsWith("go-to.") && id !== "go-to.search") return "command-scope-go-to";
  if (id.startsWith("split.")) return "split";
  if (id === "home.focus-chat-input") return "split";
  if (id === "block.share") return "block";
  if (csvScope.includes("command-scope-create-menu")) return "command-scope-create-menu";
  if (csvScope.includes("command-scope-command-menu-category")) return "command-scope-command-menu-category";
  if (csvScope.includes("command-scope-go-to")) return "command-scope-go-to";
  if (csvScope.includes("detached")) return "detached";
  return "global";
}

function parseChords(raw, id) {
  const hotkeys = raw.trim();
  if (!hotkeys || hotkeys.startsWith("(none") || hotkeys.startsWith("(scope")) return [];
  return hotkeys.split(" | ").flatMap((part) => {
    const token = part.trim();
    if (!token || token.startsWith("(")) return [];
    if (/^[goc] [a-z0-9/?]+$/i.test(token) && id.startsWith("go-to.")) return [token.slice(2).toLowerCase()];
    return [token.toLowerCase()];
  });
}

function registrationType(priority) {
  return /\badd\b/.test(priority) && !/override/.test(priority) ? "add" : "override";
}

const rows = parseCsv(readFileSync(csvPath, "utf8"));
const header = rows[0];
const idx = Object.fromEntries(header.map((name, i) => [name, i]));
const keyed = [];
const unkeyed = [];
const seen = new Set();

for (const row of rows.slice(1)) {
  if (!row[idx.command_identity]) continue;
  const id = remapId(row[idx.command_identity]);
  if (!N5_IDS.has(id) || seen.has(`${id}:${row[idx.hotkeys]}`)) continue;
  seen.add(`${id}:${row[idx.hotkeys]}`);
  const chords = parseChords(row[idx.hotkeys] ?? "", id);
  const input = (row[idx.input_focus_behavior] ?? "").includes("runs-with-input-focused");
  const type = registrationType(row[idx.shadowing_priority] ?? "");
  const scope = mapScope(id, row[idx.scope] ?? "");
  if (chords.length === 0) {
    unkeyed.push(id);
    continue;
  }
  for (const chord of chords) {
    keyed.push({
      id,
      scope,
      chord,
      runWithInputFocused: input,
      registrationType: type,
    });
  }
}

const uniqueUnkeyed = [...new Set(unkeyed)];
const body = `/** Generated from 03-command-hotkey-ledger.csv — do not edit by hand. */
import type { N5CommandId } from "./n5-command-ids.js";
import type { RegistrationType, ScopeId } from "./registry.js";

export interface N5LedgerBinding {
  id: N5CommandId;
  scope: ScopeId;
  chord: string;
  runWithInputFocused: boolean;
  registrationType: RegistrationType;
}

/** Ledger rows with at least one keyboard chord. */
export const N5_KEYED_BINDINGS = ${JSON.stringify(keyed, null, 2)} as const satisfies readonly N5LedgerBinding[];

/** Command-menu-only / scope-registration rows (no chord). */
export const N5_UNKEYED_IDS = ${JSON.stringify(uniqueUnkeyed, null, 2)} as const satisfies readonly N5CommandId[];
`;

writeFileSync(outPath, body);
console.log(
  `wrote ${keyed.length} keyed bindings (${new Set(keyed.map((row) => row.id)).size} ids), ${uniqueUnkeyed.length} unkeyed → ${outPath}`,
);
