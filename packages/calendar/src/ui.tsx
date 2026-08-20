import type { SoupItem } from "soup/browser";
import { Shell } from "shell";
import type { CalendarView } from "./types.js";
import type { CalendarEventRecord, CallRecord } from "./types.js";
import type { TranscriptRecord } from "./transcripts.js";

export function EventComposePopover({ open, title }: { open: boolean; title: string }) {
  if (!open) return null;
  return (
    <form data-scope="calendar-compose-popover" data-command="calendar.today">
      <label>
        Title
        <input name="title" defaultValue={title} aria-label="Event title" />
      </label>
      <button type="submit">Create event</button>
    </form>
  );
}

export function ReminderComposer({ open }: { open: boolean }) {
  if (!open) return null;
  return (
    <form data-scope="reminder-composer" data-command="reminder-composer.escape">
      <label>
        When
        <input name="when" aria-label="Reminder when" />
      </label>
      <button type="button">Close</button>
    </form>
  );
}

export function CalendarViewSwitcher({ view }: { view: CalendarView }) {
  return (
    <nav data-surface="calendar.view" data-view={view} aria-label="Calendar view">
      <button type="button" data-command="calendar.view.day">
        Day
      </button>
      <button type="button" data-command="calendar.view.week">
        Week
      </button>
      <button type="button" data-command="calendar.view.month">
        Month
      </button>
      <button type="button" data-command="calendar.previous-period">
        Previous
      </button>
      <button type="button" data-command="calendar.next-period">
        Next
      </button>
      <button type="button" data-command="calendar.today">
        Today
      </button>
    </nav>
  );
}

export function EventList({ items }: { items: readonly SoupItem[] }) {
  return (
    <ul data-surface="soup.calendar" role="list">
      {items.map((item) => (
        <li
          key={item.entityId}
          data-entity-id={item.entityId}
          data-entity-type={item.entityType}
        >
          {item.title}
        </li>
      ))}
    </ul>
  );
}

export function CallList({ items }: { items: readonly SoupItem[] }) {
  return (
    <ul data-surface="soup.calls" role="list">
      {items.map((item) => (
        <li
          key={item.entityId}
          data-entity-id={item.entityId}
          data-entity-type={item.entityType}
        >
          {item.title}
        </li>
      ))}
    </ul>
  );
}

export function EventDetail({ event }: { event: CalendarEventRecord | null }) {
  if (!event) return null;
  return (
    <article data-surface="calendar.event" data-entity-id={event.id} data-entity-type="calendar_event">
      <h2>{event.title}</h2>
    </article>
  );
}

export function CallDetail({
  call,
  transcript,
}: {
  call: CallRecord | null;
  transcript?: TranscriptRecord | null;
}) {
  if (!call) return null;
  return (
    <article data-surface="calendar.call" data-entity-id={call.id} data-entity-type="call" data-status={call.status}>
      <h2>{call.title}</h2>
      {transcript ? <p data-surface="calendar.transcript">{transcript.body}</p> : null}
    </article>
  );
}

export function CalendarWorkspace({
  surface = "calendar",
  events,
  calls,
  openEvent,
  openCall,
  transcript,
  view = "week",
  composeOpen,
  reminderOpen,
  draft,
}: {
  surface?: "calendar" | "calls";
  events: readonly SoupItem[];
  calls?: readonly SoupItem[];
  openEvent?: CalendarEventRecord | null;
  openCall?: CallRecord | null;
  transcript?: TranscriptRecord | null;
  view?: CalendarView;
  composeOpen: boolean;
  reminderOpen?: boolean;
  draft: string;
}) {
  const path = surface === "calls" ? "/calls" : "/calendar";
  const pane =
    surface === "calls"
      ? { type: "call" as const, id: openCall?.id ?? "_" }
      : { type: "calendar" as const, id: openEvent?.id ?? "_" };
  return (
    <div data-slice={surface === "calls" ? "calls" : "calendar"}>
      <Shell path={path} panes={[pane]} theme="outreach-dark" />
      {surface === "calendar" ? <CalendarViewSwitcher view={view} /> : null}
      <EventComposePopover open={composeOpen} title={draft} />
      <ReminderComposer open={reminderOpen ?? false} />
      {surface === "calendar" ? <EventList items={events} /> : <CallList items={calls ?? []} />}
      <EventDetail event={openEvent ?? null} />
      <CallDetail call={openCall ?? null} transcript={transcript ?? null} />
    </div>
  );
}
