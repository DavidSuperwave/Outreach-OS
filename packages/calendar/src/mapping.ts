import { fixtureId } from "registry";

/**
 * OD-1 Branch A migration fixture: identity-mapping dry run for calendar/call
 * tables. Never writes authorities. Postgres numeric rows map onto typed ids.
 */
export const CALENDAR_TABLES = [
  "calendar_events",
  "calendar_accounts",
  "call_records",
  "call_participants",
  "transcripts",
  "reminders",
] as const;

export type LegacyCalendarTable = (typeof CALENDAR_TABLES)[number];

export interface LegacyCalendarRef {
  table: LegacyCalendarTable;
  pgId: number;
}

export interface IdentityMappingResult {
  legacy: LegacyCalendarRef;
  mappedId: string;
  entityType: "calendar_event" | "call" | "reminder";
  role: "event" | "account" | "call" | "participant" | "transcript" | "reminder";
  wrote: false;
}

export function mapLegacyCalendarId(ref: LegacyCalendarRef): IdentityMappingResult {
  if (ref.table === "calendar_events") {
    return {
      legacy: ref,
      mappedId: fixtureId("calendar_event", ref.pgId),
      entityType: "calendar_event",
      role: "event",
      wrote: false,
    };
  }
  if (ref.table === "calendar_accounts") {
    return {
      legacy: ref,
      mappedId: fixtureId("calendar_event", ref.pgId),
      entityType: "calendar_event",
      role: "account",
      wrote: false,
    };
  }
  if (ref.table === "call_records") {
    return {
      legacy: ref,
      mappedId: fixtureId("call", ref.pgId),
      entityType: "call",
      role: "call",
      wrote: false,
    };
  }
  if (ref.table === "call_participants") {
    return {
      legacy: ref,
      mappedId: fixtureId("call", ref.pgId),
      entityType: "call",
      role: "participant",
      wrote: false,
    };
  }
  if (ref.table === "transcripts") {
    return {
      legacy: ref,
      mappedId: fixtureId("call", ref.pgId),
      entityType: "call",
      role: "transcript",
      wrote: false,
    };
  }
  return {
    legacy: ref,
    mappedId: fixtureId("reminder", ref.pgId),
    entityType: "reminder",
    role: "reminder",
    wrote: false,
  };
}

export function dryRunIdentityMapping(refs: readonly LegacyCalendarRef[]): IdentityMappingResult[] {
  return refs.map(mapLegacyCalendarId);
}
