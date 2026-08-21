import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { fixtureId, resetIdSequence } from "registry";
import { userPrincipal } from "identity/principal";
import { ownerOf } from "control-plane";
import { commandEnabled as chromeEnabled, defaultChromeContext } from "shell";
import { MailboxSlice, actorContext, requestContext } from "./slice.js";
import { dryRunIdentityMapping, EMAIL_TABLES } from "./mapping.js";
import {
  MAILBOX_COMMAND_IDS,
  MAILBOX_COMMAND_FREEZE_COUNT,
  EMAIL_COMMAND_IDS,
  EMAIL_COMMAND_COUNT,
  THREAD_COMMAND_IDS,
  THREAD_COMMAND_COUNT,
  N11_PARITY_COMMAND_IDS,
  commandEnabled,
  defaultMailContext,
} from "./commands.js";
import { MailboxError } from "./errors.js";
import { gmailHookPath } from "./sync.js";
import { MailboxWorkspace } from "./ui.js";
import type { GmailHistoryRecord } from "./types.js";

const tenant = fixtureId("team", 1);
const ownerId = fixtureId("user", 1);

function ownerActor() {
  return actorContext(userPrincipal(ownerId, tenant));
}

function inbound(overrides: Partial<GmailHistoryRecord> = {}): GmailHistoryRecord {
  return {
    gmailMessageId: "gmail_msg_in_1",
    gmailThreadId: "gmail_th_1",
    historyId: "10",
    from: "prospect@example.com",
    to: ["hello@superwave.example"],
    subject: "Intraplex ICP",
    body: "Can we inspect the playbook?",
    ...overrides,
  };
}

describe("N11 company mailbox + email (05-MAP row 8)", () => {
  it("maps 23 email_* tables without writing (OD-1 Branch A)", () => {
    expect(EMAIL_TABLES).toHaveLength(23);
    expect(EMAIL_TABLES.every((table) => table.startsWith("email_"))).toBe(true);
    const mapped = dryRunIdentityMapping(EMAIL_TABLES.map((table, index) => ({ table, pgId: index + 1 })));
    expect(mapped.every((row) => row.wrote === false)).toBe(true);
    expect(mapped.every((row) => row.entityType === "email_thread")).toBe(true);
    expect(mapped.map((row) => row.role)).toContain("thread");
    expect(mapped.map((row) => row.role)).toContain("message");
    expect(mapped.map((row) => row.role)).toContain("history_cursor");
    const slice = new MailboxSlice();
    expect(slice.registry.get(mapped[2]!.mappedId)).toBeNull();
  });

  it("reads/syncs one thread and executes one approved Gmail write with an audit trail", () => {
    resetIdSequence();
    const slice = new MailboxSlice();
    const api = slice.openApi();
    const { account } = api.connectAccount(
      "hello@superwave.example",
      requestContext(ownerActor(), { correlationId: "acct-1" }),
    );
    expect(api.webhookUrl(account.id)).toBe(gmailHookPath(account.id));
    expect(api.webhookUrl(account.id)).toBe(`/hooks/gmail/${account.id}`);

    const first = api.applyPush(
      { accountId: account.id, historyId: "10", records: [inbound()] },
      requestContext(ownerActor(), { correlationId: "push-1" }),
    );
    expect(first.applied).toBe(1);
    expect(first.skipped).toBe(0);
    expect(first.checkpoint.historyId).toBe("10");
    expect(slice.getCheckpoint(account.id)?.historyId).toBe("10");

    const inbox = api.listInbox(
      [
        slice.engine.mint({
          actor: ownerActor(),
          entityType: "email_thread",
          entityId: slice.plane.lists.snapshot()[0]!.entityId,
          need: "view",
        }),
      ],
    );
    expect(inbox).toHaveLength(1);
    expect(inbox[0]?.entityType).toBe("email_thread");
    expect(inbox[0]?.title).toBe("Intraplex ICP");

    const threadId = inbox[0]!.entityId;
    const viewed = api.getThread(threadId, requestContext(ownerActor(), { correlationId: "read-1" }));
    expect(viewed.messages).toHaveLength(1);
    expect(viewed.messages[0]?.body).toBe("Can we inspect the playbook?");
    expect(viewed.thread.gmailThreadId).toBe("gmail_th_1");

    const dup = api.applyPush(
      { accountId: account.id, historyId: "10", records: [inbound()] },
      requestContext(ownerActor(), { correlationId: "push-dup" }),
    );
    expect(dup.applied).toBe(0);
    expect(dup.skipped).toBe(1);
    expect(api.listMessages(threadId)).toHaveLength(1);

    const receipt = slice.engine.mint({
      actor: ownerActor(),
      entityType: "email_thread",
      entityId: threadId,
      need: "edit",
    });
    const ownerCtx = requestContext(ownerActor(), { receipt, correlationId: "send-1" });
    const pending = api.submitSend(
      {
        accountId: account.id,
        threadId,
        to: ["prospect@example.com"],
        subject: "Re: Intraplex ICP",
        body: "Inspect then ask.",
      },
      ownerCtx,
    );
    expect(pending.status).toBe("pending");
    expect(slice.gmail.sent).toHaveLength(0);

    expect(() => api.applySend(pending.actionId, ownerCtx)).toThrow(MailboxError);
    expect(() => api.applySend(pending.actionId, ownerCtx)).toThrow(/approved before apply/);

    const approved = api.approveSend(pending.actionId, ownerCtx);
    expect(approved.status).toBe("approved");
    const written = api.applySend(pending.actionId, ownerCtx);
    expect(slice.approval.get(pending.actionId)?.status).toBe("applied");
    expect(slice.gmail.sent).toHaveLength(1);
    expect(written.messages.map((row) => row.direction)).toEqual(["inbound", "outbound"]);
    expect(written.messages[1]?.body).toBe("Inspect then ask.");

    const sentFacts = slice.activity.list().filter((fact) => fact.action === "sent");
    expect(sentFacts).toHaveLength(1);
    expect(sentFacts[0]?.entityType).toBe("email_thread");
    expect(sentFacts[0]?.entityId).toBe(threadId);
    expect(sentFacts[0]?.actorId).toBe(ownerId);
    expect(Object.keys(api)).not.toContain("smtpSend");
    expect(Object.keys(api)).not.toContain("sendViaInstantly");
    expect(Object.keys(api)).not.toContain("activate");
    expect(Object.keys(api)).not.toContain("start");
  });

  it("forbids SMTP, live Gmail, and Instantly send/activate/start", () => {
    const slice = new MailboxSlice();
    expect(() => slice.smtpSend()).toThrow(MailboxError);
    expect(() => slice.smtpSend()).toThrow(/SMTP/);
    expect(() => slice.gmail.liveFetch()).toThrow(/live Gmail/);
    expect(() => slice.sendViaInstantly()).toThrow(/Instantly send\/activate\/start/);
  });

  it("names the 34-command freeze and keeps opt+r reply-all dormant", () => {
    expect(EMAIL_COMMAND_IDS).toHaveLength(EMAIL_COMMAND_COUNT);
    expect(THREAD_COMMAND_IDS).toHaveLength(THREAD_COMMAND_COUNT);
    expect(MAILBOX_COMMAND_IDS).toHaveLength(MAILBOX_COMMAND_FREEZE_COUNT);
    expect(new Set(MAILBOX_COMMAND_IDS).size).toBe(34);
    expect(EMAIL_COMMAND_IDS).toContain("email.reply-all-opt");
    expect(THREAD_COMMAND_IDS).toEqual(
      expect.arrayContaining(["thread.enter", "thread.reply", "thread.cancel-reply"]),
    );
    expect(commandEnabled("email.reply-all-opt", defaultMailContext())).toBe(false);
    expect(commandEnabled("email.reply", defaultMailContext())).toBe(true);
    expect(commandEnabled("thread.enter", defaultMailContext({ threadFocused: false }))).toBe(false);
    expect(commandEnabled("email.compose.send", defaultMailContext({ composeOpen: true }))).toBe(true);
    expect(commandEnabled("email.compose.send", defaultMailContext({ composeOpen: false }))).toBe(false);

    const chrome = defaultChromeContext({ leader: "c", signedIn: true });
    expect(chromeEnabled("create-menu.email", chrome)).toBe(true);
    expect(chromeEnabled("go-to.mail", chrome)).toBe(true);
    expect(chromeEnabled("go-to.inbox", chrome)).toBe(true);
    expect(N11_PARITY_COMMAND_IDS).toEqual(
      expect.arrayContaining(["create-menu.email", "go-to.mail", "email.send", "thread.enter"]),
    );
  });

  it("renders MailboxWorkspace on Shell /mail and /inbox without Macro branding", () => {
    resetIdSequence();
    const slice = new MailboxSlice();
    const api = slice.openApi();
    const { account } = api.connectAccount(
      "hello@superwave.example",
      requestContext(ownerActor(), { correlationId: "ui-acct" }),
    );
    api.applyPush(
      { accountId: account.id, historyId: "10", records: [inbound()] },
      requestContext(ownerActor(), { correlationId: "ui-push" }),
    );
    const threadId = [...slice.plane.lists.snapshot()].find((row) => row.entityType === "email_thread")!.entityId;
    const receipt = slice.engine.mint({
      actor: ownerActor(),
      entityType: "email_thread",
      entityId: threadId,
      need: "view",
    });
    const viewed = api.getThread(threadId, requestContext(ownerActor(), { receipt, correlationId: "ui-read" }));
    const mail = renderToString(
      createElement(MailboxWorkspace, {
        items: api.listInbox([receipt]),
        thread: viewed.thread,
        messages: viewed.messages,
        composeOpen: true,
        draft: "Re: Intraplex ICP",
        path: "/mail",
      }),
    );
    expect(mail).toContain("data-shell=\"outreach-os\"");
    expect(mail).toContain("data-split=\"email\"");
    expect(mail).toContain("data-path=\"/email/_\"");
    expect(mail).toContain("href=\"/mail\"");
    expect(mail).toContain("Intraplex ICP");
    expect(mail).toContain("Can we inspect the playbook?");
    expect(mail).toContain("data-command=\"email.send\"");
    expect(mail).toContain("data-surface=\"soup.mail\"");
    expect(mail).toContain("Gmail-API send via approval queue");
    expect(mail).not.toMatch(/macro/i);

    const inbox = renderToString(
      createElement(MailboxWorkspace, {
        items: api.listInbox([receipt]),
        thread: viewed.thread,
        messages: viewed.messages,
        composeOpen: false,
        draft: "",
        path: "/inbox",
      }),
    );
    expect(inbox).toContain("data-split=\"inbox\"");
    expect(inbox).toContain("data-path=\"/inbox/_\"");
    expect(inbox).toContain("href=\"/inbox\"");
    expect(inbox).toContain("Pub/Sub push sync with checkpoints");
  });

  it("registers email_thread and mailbox_sync_checkpoint in STORAGE_OWNERS", () => {
    expect(ownerOf("email_thread").owner).toBe("mailbox.MailboxSlice");
    expect(ownerOf("email_thread").kind).toBe("d1");
    expect(ownerOf("mailbox_sync_checkpoint").owner).toBe("mailbox.MailboxSlice");
    expect(ownerOf("mailbox_sync_checkpoint").kind).toBe("do");
    expect(ownerOf("mailbox_sync_checkpoint").checkpoint).toBe("mailbox.sync");
  });
});
