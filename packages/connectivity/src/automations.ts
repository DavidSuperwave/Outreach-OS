import { IdempotencyStore, runOnce } from "control-plane";
import { ConnectivityError } from "./errors.js";

export const AUTOMATION_ACTION_KIND = "Agent" as const;

export interface CronFields {
  minute: Set<number> | "any"
  hour: Set<number> | "any"
  dayOfMonth: Set<number> | "any"
  month: Set<number> | "any"
  dayOfWeek: Set<number> | "any"
}

export interface AutomationRecord {
  id: string
  prompt: string
  cron: string
  timeZone: string
  actionKind: typeof AUTOMATION_ACTION_KIND
  ownerId: string
  tenantId: string
  enabled: boolean
}

export interface AutomationRun {
  automationId: string
  scheduledTick: string
  startedAt: string
  kernelSession: "spawned"
}

export interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  dayOfWeek: number
  epochMs: number
  timeZone: string
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function parseField(field: string, min: number, max: number): Set<number> | "any" {
  if (field === "*") return "any";
  const values = new Set<number>();
  for (const part of field.split(",")) {
    const stepSplit = part.split("/");
    const range = stepSplit[0]!;
    const step = stepSplit[1] ? Number(stepSplit[1]) : 1;
    if (!Number.isInteger(step) || step < 1) throw new ConnectivityError("invalid_cron", `bad step ${part}`);
    let start = min;
    let end = max;
    if (range !== "*") {
      const bounds = range.split("-").map(Number);
      start = bounds[0]!;
      end = bounds[1] ?? bounds[0]!;
    }
    if (start < min || end > max || start > end) {
      throw new ConnectivityError("invalid_cron", `field ${part} out of range`);
    }
    for (let value = start; value <= end; value += step) values.add(value);
  }
  return values;
}

export function assertTimeZone(id: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: id }).format(0);
  } catch {
    throw new ConnectivityError("invalid_cron", `unknown IANA timezone ${id}`);
  }
}

export function parseCron(expr: string): CronFields {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) throw new ConnectivityError("invalid_cron", "cron must have 5 fields");
  return {
    minute: parseField(parts[0]!, 0, 59),
    hour: parseField(parts[1]!, 0, 23),
    dayOfMonth: parseField(parts[2]!, 1, 31),
    month: parseField(parts[3]!, 1, 12),
    dayOfWeek: parseField(parts[4]!, 0, 6),
  };
}

function matches(field: Set<number> | "any", value: number): boolean {
  return field === "any" || field.has(value);
}

export function zonedParts(epochMs: number, timeZone: string): ZonedParts {
  assertTimeZone(timeZone);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(new Date(epochMs))) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour),
    minute: Number(bag.minute),
    second: Number(bag.second),
    dayOfWeek: WEEKDAY_INDEX[bag.weekday ?? ""] ?? 0,
    epochMs,
    timeZone,
  };
}

export function cronMatches(expr: string, parts: ZonedParts): boolean {
  const cron = parseCron(expr);
  return (
    matches(cron.minute, parts.minute) &&
    matches(cron.hour, parts.hour) &&
    matches(cron.dayOfMonth, parts.day) &&
    matches(cron.month, parts.month) &&
    matches(cron.dayOfWeek, parts.dayOfWeek)
  );
}

export function scheduledTickId(automationId: string, epochMs: number): string {
  return `${automationId}:${epochMs}`;
}

export class AutomationStore {
  readonly rows = new Map<string, AutomationRecord>();
  readonly runs: AutomationRun[] = [];
  readonly idempotency = new IdempotencyStore();
  #seq = 0;

  create(input: {
    prompt: string
    cron: string
    timeZone: string
    ownerId: string
    tenantId: string
  }): AutomationRecord {
    parseCron(input.cron);
    assertTimeZone(input.timeZone);
    this.#seq += 1;
    const record: AutomationRecord = {
      id: `atm_${this.#seq.toString(16).padStart(32, "0")}`,
      prompt: input.prompt,
      cron: input.cron,
      timeZone: input.timeZone,
      actionKind: AUTOMATION_ACTION_KIND,
      ownerId: input.ownerId,
      tenantId: input.tenantId,
      enabled: true,
    };
    this.rows.set(record.id, record);
    return record;
  }

  /**
   * Fire if the zoned minute matches. Idempotent on (automationId, epochMs).
   * DST: tick keys are instants, so fall-back civil duplicates stay distinct.
   */
  fire(automationId: string, epochMs: number): AutomationRun | null {
    const record = this.rows.get(automationId);
    if (!record || !record.enabled) return null;
    const parts = zonedParts(epochMs, record.timeZone);
    if (parts.second !== 0) return null;
    if (!cronMatches(record.cron, parts)) return null;
    const key = scheduledTickId(automationId, epochMs);
    return runOnce(this.idempotency, key, () => {
      const run: AutomationRun = {
        automationId,
        scheduledTick: key,
        startedAt: new Date(epochMs).toISOString(),
        kernelSession: "spawned",
      };
      this.runs.push(run);
      return run;
    });
  }
}
