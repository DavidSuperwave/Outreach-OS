import type { LiveKitRoomHandle } from "./livekit.js";

export type CalendarView = "day" | "week" | "month";

export type CallStatus = "scheduled" | "live" | "finalized";

export interface CalendarEventRecord {
  id: string;
  tenantId: string;
  title: string;
  startsAt: number;
  endsAt: number;
  /** Provider remains authoritative for mirrored events (mail-coupled account). */
  providerEventId: string | null;
  connectionId: string | null;
  /** RRULE string when present; expansion is not executed in N13. */
  recurrenceRule: string | null;
  deleted: boolean;
  version: number;
  createdAt: number;
}

export interface CallRecord {
  id: string;
  tenantId: string;
  title: string;
  status: CallStatus;
  participantIds: string[];
  channelId: string | null;
  calendarEventId: string | null;
  room: LiveKitRoomHandle | null;
  transcriptId: string | null;
  recordingHandle: string | null;
  finalized: boolean;
  version: number;
  createdAt: number;
}

export interface ReminderRecord {
  id: string;
  tenantId: string;
  title: string;
  fireAt: number;
  timezone: string;
  fired: boolean;
  entityId: string | null;
  version: number;
  createdAt: number;
}

export interface ProviderEventInput {
  providerEventId: string;
  title: string;
  startsAt: number;
  endsAt: number;
  recurrenceRule?: string | null;
}

export interface CreateEventInput {
  title: string;
  startsAt: number;
  endsAt: number;
  providerEventId?: string | null;
  connectionId?: string | null;
  recurrenceRule?: string | null;
}

export interface CreateCallInput {
  title: string;
  participantIds?: readonly string[];
  channelId?: string | null;
  calendarEventId?: string | null;
}

export interface CreateReminderInput {
  title: string;
  fireAt: number;
  timezone?: string;
  entityId?: string | null;
}
