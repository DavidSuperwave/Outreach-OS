import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { AuthzError } from "authz";
import { fixtureId, resetIdSequence } from "registry";
import { userPrincipal } from "identity/principal";
import { ownerOf } from "control-plane";
import { commandEnabled as chromeEnabled, defaultChromeContext } from "shell";
import { CalendarSlice, actorContext, requestContext } from "./slice.js";
import { dryRunIdentityMapping, CALENDAR_TABLES } from "./mapping.js";
import {
  CALENDAR_COMMAND_IDS,
  CALENDAR_COMMAND_FREEZE_COUNT,
  N13_COMMAND_IDS,
  N13_PARITY_COMMAND_IDS,
  REMINDER_COMPOSER_COMMAND_IDS,
} from "./commands.js";
import { CALENDAR_CONNECTOR_CATALOG } from "./connectors.js";
import { CalendarError } from "./errors.js";
import { LIVEKIT_LIVE, PREVIEW_SUPPORTED, preview } from "./livekit.js";
import { CalendarWorkspace } from "./ui.js";

const tenant = fixtureId("team", 1);
const ownerId = fixtureId("user", 1);
const teammateId = fixtureId("user", 2);
const outsiderId = fixtureId("user", 3);
const otherTenant = fixtureId("team", 2);

function ownerActor() {
  return actorContext(userPrincipal(ownerId, tenant));
}

function teammateActor() {
  return actorContext(userPrincipal(teammateId, tenant), "member");
}

function outsiderActor() {
  return actorContext(userPrincipal(outsiderId, otherTenant), "outsider");
}

describe("N13 calendar + calls (05-MAP row 9)", () => {
  it("maps calendar/call tables without writing (OD-1 Branch A)", () => {
    expect(CALENDAR_TABLES).toHaveLength(6);
    const mapped = dryRunIdentityMapping(CALENDAR_TABLES.map((table, index) => ({ table, pgId: index + 1 })));
    expect(mapped.every((row) => row.wrote === false)).toBe(true);
    expect(mapped.map((row) => row.role)).toEqual([
      "event",
      "account",
      "call",
      "participant",
      "transcript",
      "reminder",
    ]);
    const slice = new CalendarSlice();
    expect(slice.registry.get(mapped[0]!.mappedId)).toBeNull();
  });

  it("opens one event and one call from Soup and denies an outsider via receipts", () => {
    resetIdSequence();
    const slice = new CalendarSlice();
    const api = slice.openApi();
    const createdEvent = api.createEvent(
      { title: "ICP review", startsAt: 100, endsAt: 200 },
      requestContext(ownerActor(), { correlationId: "ev-1" }),
    );
    const createdCall = api.createCall(
      { title: "Stand-up" },
      requestContext(ownerActor(), { correlationId: "call-1" }),
    );

    const events = api.listEvents([createdEvent.receipt]);
    const calls = api.listCalls([createdCall.receipt]);
    expect(events).toHaveLength(1);
    expect(events[0]?.entityType).toBe("calendar_event");
    expect(events[0]?.title).toBe("ICP review");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.entityType).toBe("call");
    expect(calls[0]?.title).toBe("Stand-up");

    const openedEvent = api.openEvent(createdEvent.event.id, requestContext(ownerActor(), { correlationId: "open-e" }));
    const openedCall = api.openCall(createdCall.call.id, requestContext(ownerActor(), { correlationId: "open-c" }));
    expect(openedEvent.event.id).toBe(createdEvent.event.id);
    expect(openedEvent.receipt.level).toBe("owner");
    expect(openedCall.call.id).toBe(createdCall.call.id);
    expect(openedCall.receipt.entityType).toBe("call");

    expect(api.listEvents([])).toHaveLength(0);
    expect(api.listCalls([])).toHaveLength(0);
    expect(() =>
      slice.engine.mint({
        actor: outsiderActor(),
        entityType: "calendar_event",
        entityId: createdEvent.event.id,
        need: "view",
      }),
    ).toThrow(AuthzError);
    expect(() =>
      slice.engine.mint({
        actor: teammateActor(),
        entityType: "calendar_event",
        entityId: createdEvent.event.id,
        need: "view",
      }),
    ).toThrow(AuthzError);
    expect(() => api.openEvent(createdEvent.event.id, requestContext(outsiderActor(), { correlationId: "deny-e" }))).toThrow(
      AuthzError,
    );
    expect(() => api.openCall(createdCall.call.id, requestContext(outsiderActor(), { correlationId: "deny-c" }))).toThrow(
      AuthzError,
    );
  });

  it("mirrors provider events through the N10 connector pattern without Instantly writes", () => {
    resetIdSequence();
    const slice = new CalendarSlice();
    const api = slice.openApi();
    expect(CALENDAR_CONNECTOR_CATALOG).toHaveLength(1);
    expect(CALENDAR_CONNECTOR_CATALOG[0]?.vendorId).toBe("google-calendar");
    expect(CALENDAR_CONNECTOR_CATALOG.some((row) => row.vendorId === ("instantly" as string))).toBe(false);
    const connection = api.connectProvider("Work calendar", requestContext(ownerActor(), { correlationId: "conn" }));
    expect(connection.vendorId).toBe("google-calendar");
    const mirrored = api.syncProviderEvents(
      connection.id,
      [{ providerEventId: "gcal_1", title: "Sync slot", startsAt: 1, endsAt: 2 }],
      requestContext(ownerActor(), { correlationId: "sync" }),
    );
    expect(mirrored[0]?.event.providerEventId).toBe("gcal_1");
    expect(mirrored[0]?.event.connectionId).toBe(connection.id);
    expect(() => slice.sendInstantly()).toThrow(CalendarError);
    expect(() => slice.sendInstantly()).toThrow(/does not send Instantly/);
    expect(Object.keys(api)).not.toContain("sendInstantly");
    expect(() => slice.providers.mintSession(connection.id, outsiderActor())).toThrow(/cross-tenant|user-scoped/);
  });

  it("joins a call via a LiveKit handle stub, attaches one transcript, and refuses preview", () => {
    resetIdSequence();
    const slice = new CalendarSlice();
    const api = slice.openApi();
    const { call, receipt } = api.createCall(
      { title: "Live", participantIds: [teammateId] },
      requestContext(ownerActor(), { correlationId: "lk-0" }),
    );
    expect(LIVEKIT_LIVE).toBe(false);
    expect(PREVIEW_SUPPORTED).toBe(false);
    const ctx = requestContext(ownerActor(), { receipt, correlationId: "lk-1" });
    const room = api.mintLiveKitRoom(ctx);
    expect(room.live).toBe(false);
    expect(room.url).toBeNull();
    expect(room.token.startsWith("lk_stub_")).toBe(true);
    const joined = api.joinCall(ctx);
    expect(joined.call.status).toBe("live");
    expect(joined.call.participantIds).toContain(ownerId);
    const transcript = api.attachTranscript("hello transcript", ctx);
    expect(transcript.callId).toBe(call.id);
    expect(slice.transcripts.get(call.id)?.sha).toHaveLength(64);
    expect(() => api.attachTranscript("second", ctx)).toThrow(/already attached/);
    const finalized = api.finalizeCall(ctx);
    expect(finalized.finalized).toBe(true);
    expect(() => api.joinCall(ctx)).toThrow(/finalized/);
    expect(() => api.preview()).toThrow(CalendarError);
    expect(() => preview()).toThrow(/OD-8\/N15/);
    expect(() => slice.livekit.preview()).toThrow(/unsupported/);
  });

  it("fires a reminder exactly once", () => {
    resetIdSequence();
    const slice = new CalendarSlice();
    const api = slice.openApi();
    const { reminder, receipt } = api.createReminder(
      { title: "Ping", fireAt: 50, timezone: "America/New_York" },
      requestContext(ownerActor(), { correlationId: "rmd-1" }),
    );
    const ctx = requestContext(ownerActor(), { receipt, correlationId: "rmd-2" });
    const first = api.fireReminder(ctx);
    const second = api.fireReminder(ctx);
    expect(first.fired).toBe(true);
    expect(second.fired).toBe(true);
    expect(second.version).toBe(first.version);
    expect(reminder.timezone).toBe("America/New_York");
  });

  it("names the 7-command freeze (calendar 6 + reminder-composer 1)", () => {
    expect(CALENDAR_COMMAND_IDS).toHaveLength(6);
    expect(REMINDER_COMPOSER_COMMAND_IDS).toEqual(["reminder-composer.escape"]);
    expect(N13_COMMAND_IDS).toHaveLength(CALENDAR_COMMAND_FREEZE_COUNT);
    expect(new Set(N13_COMMAND_IDS).size).toBe(7);
    expect(CALENDAR_COMMAND_IDS).toEqual([
      "calendar.view.day",
      "calendar.view.week",
      "calendar.view.month",
      "calendar.previous-period",
      "calendar.next-period",
      "calendar.today",
    ]);
    expect(N13_PARITY_COMMAND_IDS).toEqual(
      expect.arrayContaining(["go-to.calendar", "go-to.calls", "reminder-composer.escape"]),
    );
    const chrome = defaultChromeContext({ leader: "g", signedIn: true });
    expect(chromeEnabled("go-to.calendar", chrome)).toBe(true);
    expect(chromeEnabled("go-to.calls", chrome)).toBe(true);
    expect(chromeEnabled("go-to.reminders", chrome)).toBe(true);
  });

  it("renders CalendarWorkspace on Shell /calendar and /calls without Macro branding", () => {
    resetIdSequence();
    const slice = new CalendarSlice();
    const api = slice.openApi();
    const { event, receipt: eventReceipt } = api.createEvent(
      { title: "Visible event", startsAt: 1, endsAt: 2 },
      requestContext(ownerActor(), { correlationId: "ui-e" }),
    );
    const { call, receipt: callReceipt } = api.createCall(
      { title: "Visible call" },
      requestContext(ownerActor(), { correlationId: "ui-c" }),
    );
    const calHtml = renderToString(
      createElement(CalendarWorkspace, {
        surface: "calendar",
        events: api.listEvents([eventReceipt]),
        openEvent: event,
        composeOpen: true,
        reminderOpen: true,
        draft: "Visible event",
        view: "week",
      }),
    );
    expect(calHtml).toContain("data-shell=\"outreach-os\"");
    expect(calHtml).toContain("data-split=\"calendar\"");
    expect(calHtml).toContain("href=\"/calendar\"");
    expect(calHtml).toContain("Visible event");
    expect(calHtml).toContain("data-command=\"calendar.view.week\"");
    expect(calHtml).toContain("data-command=\"reminder-composer.escape\"");
    expect(calHtml).toContain("data-surface=\"soup.calendar\"");
    expect(calHtml).not.toMatch(/macro/i);

    const callHtml = renderToString(
      createElement(CalendarWorkspace, {
        surface: "calls",
        events: [],
        calls: api.listCalls([callReceipt]),
        openCall: call,
        composeOpen: false,
        draft: "",
      }),
    );
    expect(callHtml).toContain("data-split=\"call\"");
    expect(callHtml).toContain("href=\"/calls\"");
    expect(callHtml).toContain("Visible call");
    expect(callHtml).toContain("data-surface=\"soup.calls\"");
    expect(callHtml).not.toMatch(/macro/i);
  });

  it("registers calendar_index, calls_index, call_lifecycle, and transcript_sidecar in STORAGE_OWNERS", () => {
    expect(ownerOf("calendar_index").owner).toBe("calendar-projector");
    expect(ownerOf("calendar_index").kind).toBe("d1");
    expect(ownerOf("calls_index").kind).toBe("d1");
    expect(ownerOf("call_lifecycle").owner).toBe("calendar.CalendarSlice");
    expect(ownerOf("call_lifecycle").kind).toBe("do");
    expect(ownerOf("transcript_sidecar").owner).toBe("calendar.TranscriptSidecar");
  });
});
