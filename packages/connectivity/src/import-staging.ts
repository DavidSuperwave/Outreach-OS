import { IdempotencyStore, runOnce } from "control-plane";
import { ConnectivityError } from "./errors.js";

export const IMPORT_SOURCES = {
  linear: { mcp: "https://mcp.linear.app", target: "task" },
  notion: { mcp: "https://mcp.notion.com", target: "md" },
  slack: { mcp: "https://mcp.slack.com", target: "channel" },
} as const;

export type ImportSource = keyof typeof IMPORT_SOURCES;

export const IMPORT_GATHER_MAX_TURNS = 24;
export const IMPORT_GATHER_TIMEOUT_MS = 90_000;

export type ImportStatus = "staged" | "importing" | "imported" | "discarded";

export interface ImportCandidate {
  source: ImportSource
  externalId: string
  normalizedId: string
  title: string
  target: (typeof IMPORT_SOURCES)[ImportSource]["target"]
}

export interface ImportRun {
  id: string
  userId: string
  source: ImportSource
  status: ImportStatus
  candidates: ImportCandidate[]
  turns: number
}

export function normalizeNotionId(raw: string): string {
  const hex = raw.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) throw new ConnectivityError("unknown_connector", `notion id must collapse to 32 hex, got ${raw}`);
  return hex;
}

export function normalizeSlackId(raw: string): string {
  return raw;
}

export function normalizeImportId(source: ImportSource, raw: string): string {
  if (source === "notion") return normalizeNotionId(raw);
  return normalizeSlackId(raw);
}

export class ImportLedger {
  readonly runs = new Map<string, ImportRun>();
  readonly idempotency = new IdempotencyStore();
  #seq = 0;

  gather(input: {
    userId: string
    source: ImportSource
    candidates: { externalId: string; title: string }[]
    turns?: number
  }): ImportRun {
    const key = `${input.userId}:${input.source}`;
    return runOnce(this.idempotency, `gather:${key}`, () => {
      const turns = input.turns ?? 1;
      if (turns > IMPORT_GATHER_MAX_TURNS) {
        throw new ConnectivityError("denied", "import gather exceeded 24 turns");
      }
      this.#seq += 1;
      const run: ImportRun = {
        id: `imp_${this.#seq.toString(16).padStart(32, "0")}`,
        userId: input.userId,
        source: input.source,
        status: "staged",
        turns,
        candidates: input.candidates.map((row) => ({
          source: input.source,
          externalId: row.externalId,
          normalizedId: normalizeImportId(input.source, row.externalId),
          title: row.title,
          target: IMPORT_SOURCES[input.source].target,
        })),
      };
      this.runs.set(run.id, run);
      return run;
    });
  }

  confirm(runId: string): ImportRun {
    const run = this.#require(runId);
    if (run.status !== "staged") throw new ConnectivityError("duplicate", `import ${runId} is ${run.status}`);
    const next = { ...run, status: "imported" as const };
    this.runs.set(runId, next);
    return next;
  }

  discard(runId: string): ImportRun {
    const run = this.#require(runId);
    const next = { ...run, status: "discarded" as const };
    this.runs.set(runId, next);
    return next;
  }

  #require(runId: string): ImportRun {
    const run = this.runs.get(runId);
    if (!run) throw new ConnectivityError("unknown_connector", `unknown import ${runId}`);
    return run;
  }
}
