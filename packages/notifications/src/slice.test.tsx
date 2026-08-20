import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fixtureId } from "registry";
import {
  DEVICE_REGISTRATION,
  EGRESS_CHANNELS,
  GITHUB_NOTIFICATION_TYPES,
  METADATA_STRUCT_COUNT,
  METADATA_STRUCTS,
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_COUNT,
  TITLE_COPY,
  format_title,
} from "./catalog.js";
import { N18_PARITY_COMMAND_IDS, N18_UI_DATA_COMMANDS, NOTIFICATION_COMMAND_IDS } from "./commands.js";
import { NotificationsError } from "./errors.js";
import { fromGitHubEvent, GITHUB_EVENT_TYPE_MAP, N10_GITHUB_INGRESS_EVENTS } from "./github.js";
import { notificationId } from "./ids.js";
import { dryRunIdentityMapping, NOTIFICATION_TABLES } from "./mapping.js";
import { NotificationsSlice } from "./slice.js";
import type { NotificationIntent, NotificationType } from "./catalog.js";
import { NotificationWorkspace } from "./ui.js";

const recipient = fixtureId("user", 1);
const other = fixtureId("user", 2);
const entity = fixtureId("document", 1);

function src(name: string): string {
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), name), "utf8");
}

function intent(
  type: NotificationType,
  overrides: Partial<NotificationIntent> = {},
): NotificationIntent {
  return {
    eventId: "evt-1",
    recipientId: recipient,
    type,
    entityId: entity,
    meta: { title: "Alpha" },
    ...overrides,
  };
}

describe("N18 catalog (D1 / D5)", () => {
  it("freezes exactly 19 types, 7 github-prefixed, 22 metadata structs", () => {
    expect(NOTIFICATION_TYPES).toHaveLength(19);
    expect(NOTIFICATION_TYPE_COUNT).toBe(19);
    expect(GITHUB_NOTIFICATION_TYPES).toHaveLength(7);
    expect(GITHUB_NOTIFICATION_TYPES.every((type) => type.startsWith("github_"))).toBe(true);
    expect(NOTIFICATION_TYPES.filter((type) => type.startsWith("github_"))).toEqual([...GITHUB_NOTIFICATION_TYPES]);
    expect(METADATA_STRUCTS).toHaveLength(22);
    expect(METADATA_STRUCT_COUNT).toBe(22);
    expect(METADATA_STRUCTS.slice(0, 19)).toHaveLength(19);
    expect(METADATA_STRUCTS.slice(19)).toEqual(["NotificationIntent", "DigestWindow", "MuteKey"]);
  });

  it("freezes format_title copy for all 19 types", () => {
    for (const type of NOTIFICATION_TYPES) {
      const expected = TITLE_COPY[type].replaceAll("{title}", "Alpha");
      expect(format_title(type, { title: "Alpha" })).toBe(expected);
    }
    expect(format_title("github_pr_opened", { title: "Reach" })).toBe("PR opened: Reach");
    expect(Object.keys(TITLE_COPY)).toHaveLength(19);
  });
});

describe("GitHub producer helper (N10 → 7 types)", () => {
  it("maps N10's 6 ingress events plus mention onto the 7 types where applicable", () => {
    expect(N10_GITHUB_INGRESS_EVENTS).toHaveLength(6);
    expect(fromGitHubEvent("PullRequest", "opened")).toBe("github_pr_opened");
    expect(fromGitHubEvent("PullRequest", "merged")).toBe("github_pr_merged");
    expect(fromGitHubEvent("PullRequest", "closed")).toBe("github_pr_closed");
    expect(fromGitHubEvent("PullRequest", "closed", { merged: true })).toBe("github_pr_merged");
    expect(fromGitHubEvent("IssueComment")).toBe("github_pr_comment");
    expect(fromGitHubEvent("PullRequestReviewComment")).toBe("github_pr_comment");
    expect(fromGitHubEvent("PullRequest", "review_requested")).toBe("github_review_requested");
    expect(fromGitHubEvent("PullRequestReview", "submitted")).toBe("github_review_submitted");
    expect(fromGitHubEvent("mention")).toBe("github_mention");
    expect(fromGitHubEvent("github_mention")).toBe("github_mention");
    expect(fromGitHubEvent("CheckRun")).toBeNull();
    expect(fromGitHubEvent("Installation")).toBeNull();
    expect(fromGitHubEvent("pull_request", "opened")).toBe("github_pr_opened");
    expect(fromGitHubEvent("gollum")).toBeNull();

    const reached = new Set<string>();
    const fixtures: Array<[string, string?]> = [
      ["PullRequest", "opened"],
      ["PullRequest", "merged"],
      ["PullRequest", "closed"],
      ["IssueComment"],
      ["PullRequest", "review_requested"],
      ["PullRequestReview"],
      ["mention"],
    ];
    for (const [name, action] of fixtures) {
      const type = fromGitHubEvent(name, action);
      if (type) reached.add(type);
    }
    expect(reached.size).toBe(7);
    expect([...reached].sort()).toEqual([...GITHUB_NOTIFICATION_TYPES].sort());
    expect(GITHUB_EVENT_TYPE_MAP.CheckRun).toEqual([]);
    expect(GITHUB_EVENT_TYPE_MAP.Installation).toEqual([]);
  });
});

describe("N18 ingest + unread (05-MAP row 13)", () => {
  it("assigns a deterministic id and treats duplicate ingest as a no-op", () => {
    const api = new NotificationsSlice().openApi();
    const first = api.ingest(intent("channel_mention"));
    const second = api.ingest(intent("channel_mention", { meta: { title: "Other" } }));
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(first.notification.id).toBe(notificationId("evt-1", recipient));
    expect(second.notification.id).toBe(first.notification.id);
    expect(second.notification.title).toBe("Mentioned: Alpha");
    expect(api.list(recipient)).toHaveLength(1);
    expect(api.unreadCount(recipient)).toBe(1);
  });

  it("derives unread from !seen and reconciles markSeen/markDone/undone/delete", () => {
    const api = new NotificationsSlice().openApi();
    const a = api.ingest(intent("channel_reply", { eventId: "e-a" }));
    const b = api.ingest(intent("channel_send", { eventId: "e-b" }));
    expect(api.unreadCount(recipient)).toBe(2);
    expect(api.unreadCount(recipient)).toBe(api.list(recipient).filter((row) => !row.seen).length);

    api.markSeen(recipient, a.notification.id);
    expect(api.unreadCount(recipient)).toBe(1);
    api.markDone(recipient, b.notification.id);
    expect(api.unreadCount(recipient)).toBe(0);
    api.undone(recipient, b.notification.id);
    expect(api.list(recipient).find((row) => row.id === b.notification.id)?.done).toBe(false);
    expect(api.unreadCount(recipient)).toBe(0);

    api.delete(recipient, a.notification.id);
    expect(api.list(recipient)).toHaveLength(1);
    expect(api.unreadCount(recipient)).toBe(0);
  });

  it("keeps per-user authorities isolated", () => {
    const api = new NotificationsSlice().openApi();
    api.ingest(intent("email_received"));
    api.ingest(intent("email_received", { recipientId: other }));
    expect(api.unreadCount(recipient)).toBe(1);
    expect(api.unreadCount(other)).toBe(1);
    api.markSeen(recipient, notificationId("evt-1", recipient));
    expect(api.unreadCount(recipient)).toBe(0);
    expect(api.unreadCount(other)).toBe(1);
  });
});

describe("N18 preferences, mutes, egress", () => {
  it("evaluates per-type opt-out at delivery time and suppresses egress", () => {
    const slice = new NotificationsSlice();
    const api = slice.openApi();
    api.setPreference(recipient, "channel_mention", false);
    const result = api.route(intent("channel_mention"), { sessionLive: true });
    expect(result.created).toBe(true);
    expect(result.suppressed).toBe(true);
    expect(result.delivered).toEqual([]);
    expect(slice.egress.inApp.receipts).toEqual([]);
    expect(api.list(recipient)).toHaveLength(1);
  });

  it("records in-app session-push stand-in and skips push when sessionLive", () => {
    const slice = new NotificationsSlice();
    const api = slice.openApi();
    const result = api.route(intent("call_started"), { sessionLive: true });
    expect(result.skippedPush).toBe(true);
    expect(result.delivered).toHaveLength(1);
    expect(result.delivered[0]?.channel).toBe("in_app");
    expect(slice.egress.inApp.receipts).toHaveLength(1);
    expect(() => slice.egress.push.deliver(result.notification)).toThrow(NotificationsError);
    expect(() => slice.egress.push.deliver(result.notification)).toThrow(/push_deferred/);
  });

  it("push.deliver always throws push_deferred (port exists, unimplemented)", () => {
    const slice = new NotificationsSlice();
    const row = slice.ingest(intent("task_assigned")).notification;
    try {
      slice.egress.push.deliver(row);
      throw new Error("expected push_deferred");
    } catch (error) {
      expect(error).toBeInstanceOf(NotificationsError);
      expect((error as NotificationsError).code).toBe("push_deferred");
    }
    expect(DEVICE_REGISTRATION.status).toBe("parked");
    expect(DEVICE_REGISTRATION.implemented).toBe(false);
    expect(() => slice.registerDevice()).toThrow(/parked/);
    expect(EGRESS_CHANNELS).toEqual(["in_app", "email", "push"]);
  });

  it("flushes an email digest stand-in with unsubscribe code and honors unsubscribe", () => {
    const slice = new NotificationsSlice();
    const api = slice.openApi();
    api.route(intent("document_shared", { eventId: "d1" }), { sessionLive: false });
    api.route(intent("comment_added", { eventId: "d2" }), { sessionLive: false });
    api.route(intent("document_shared", { eventId: "d1" }), { sessionLive: false });
    const email = api.flushDigest(recipient);
    expect(email).not.toBeNull();
    expect(email?.channel).toBe("email");
    expect(email?.notificationIds).toHaveLength(2);
    expect(email?.unsubscribeCode).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(slice.egress.digest.receipts.some((row) => row.channel === "email")).toBe(true);

    api.unsubscribeDigest(recipient, email!.unsubscribeCode);
    api.route(intent("reminder_due", { eventId: "d3" }), { sessionLive: false });
    expect(api.flushDigest(recipient)).toBeNull();
  });

  it("mutes an entity at delivery time", () => {
    const api = new NotificationsSlice().openApi();
    api.mute({ recipientId: recipient, entityId: entity });
    const result = api.route(intent("agent_completed"), { sessionLive: true });
    expect(result.suppressed).toBe(true);
    expect(result.delivered).toEqual([]);
  });
});

describe("N18 commands + mapping + chrome", () => {
  it("has 0 direct command rows and UI data-commands for mark-seen", () => {
    expect(NOTIFICATION_COMMAND_IDS).toHaveLength(0);
    expect(N18_PARITY_COMMAND_IDS).toEqual([]);
    expect(N18_UI_DATA_COMMANDS).toEqual(["notifications.mark-seen"]);
  });

  it("maps 11 notification tables without writing (OD-1 Branch A)", () => {
    expect(NOTIFICATION_TABLES).toHaveLength(11);
    const mapped = dryRunIdentityMapping(NOTIFICATION_TABLES.map((table, index) => ({ table, pgId: index + 1 })));
    expect(mapped.every((row) => row.wrote === false)).toBe(true);
    expect(mapped.find((row) => row.legacy.table === "notification_user_device_registration")?.role).toBe(
      "parked_device",
    );
    expect(new NotificationsSlice().authorities.size).toBe(0);
  });

  it("renders NotificationWorkspace on Shell / without stealing /inbox", () => {
    const html = renderToString(
      createElement(NotificationWorkspace, {
        items: [
          {
            id: "n1",
            eventId: "evt-1",
            recipientId: recipient,
            type: "channel_mention",
            entityId: entity,
            meta: { title: "Alpha" },
            title: "Mentioned: Alpha",
            seen: false,
            done: false,
            deleted: false,
            createdAt: 1,
          },
        ],
        unreadCount: 1,
      }),
    );
    expect(html).toContain("data-shell=\"outreach-os\"");
    expect(html).toContain("data-slice=\"notifications\"");
    expect(html).toContain("data-surface=\"notifications.list\"");
    expect(html).toContain("data-unread-count=\"1\"");
    expect(html).toContain("data-command=\"notifications.mark-seen\"");
    expect(html).toContain("Mentioned: Alpha");
    expect(html).toContain("data-path=\"/home/_\"");
    expect(html).toContain("data-split=\"home\"");
    expect(html).not.toContain("data-slice=\"mailbox\"");
    expect(html).not.toContain("data-surface=\"soup.mail\"");
    expect(html).not.toMatch(/macro/i);
  });

  it("keeps browser.ts UI-only and does not add Instantly send or APNS/FCM/SNS", () => {
    const browser = src("browser.ts");
    expect(browser).not.toContain("NotificationAuthority");
    expect(browser).not.toContain("NotificationsSlice");
    expect(browser).not.toContain("node:crypto");
    expect(browser).not.toContain("from \"./egress");
    const joined = ["slice.ts", "egress.ts", "authority.ts", "github.ts", "catalog.ts", "ui.tsx"]
      .map(src)
      .join("\n");
    expect(joined).not.toMatch(/instantly\.(send|activate|start)/i);
    expect(joined).not.toMatch(/from ["']aws-sdk/);
    expect(joined).not.toMatch(/@aws-sdk\/client-sns/);
    expect(src("egress.ts")).toContain("push_deferred");
    expect(src("egress.ts")).toContain("No APNS / FCM / SNS");
  });
});
