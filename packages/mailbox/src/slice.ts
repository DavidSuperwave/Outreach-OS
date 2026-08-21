import { AccessStore, PolicyEngine, emptyAccess, requireReceipt, type Receipt } from "authz";
import {
  ActivityLog,
  IdempotencyStore,
  Outbox,
  envelope,
  requestContext,
  runOnce,
  type ActivityAction,
  type EventEnvelope,
  type RequestContext,
} from "control-plane";
import type { ActorContext } from "identity/principal";
import { EntityRegistry, nextId } from "registry";
import { ProjectionPlane, type SoupItem, type SoupListener } from "soup";
import { MailApprovalQueue } from "./approval.js";
import { MailboxError } from "./errors.js";
import { InMemoryGmailProvider } from "./gmail.js";
import { SyncCheckpointStore, gmailHookPath } from "./sync.js";
import type {
  ComposeInput,
  EmailAccount,
  EmailMessageRecord,
  EmailThreadRecord,
  GmailHistoryRecord,
  MailboxRecord,
  MailboxSyncCheckpoint,
  PubSubPush,
  SendProposal,
} from "./types.js";

export interface MailThreadView {
  thread: EmailThreadRecord;
  messages: EmailMessageRecord[];
  receipt: Receipt;
}

export interface AccountView {
  account: EmailAccount;
  mailbox: MailboxRecord;
}

export interface MailApi {
  connectAccount(email: string, ctx: RequestContext): AccountView;
  listInbox(receipts: readonly Receipt[]): SoupItem[];
  getThread(threadId: string, ctx: RequestContext): MailThreadView;
  listMessages(threadId: string): EmailMessageRecord[];
  applyPush(push: PubSubPush, ctx: RequestContext): {
    applied: number;
    skipped: number;
    checkpoint: MailboxSyncCheckpoint;
  };
  submitSend(input: ComposeInput, ctx: RequestContext): SendProposal;
  approveSend(actionId: number, ctx: RequestContext): SendProposal;
  applySend(actionId: number, ctx: RequestContext): MailThreadView;
  webhookUrl(accountId: string): string;
  subscribeLists(listener: SoupListener): () => void;
}

/**
 * Authoritative mailbox store is one in-process account map (DO stand-in).
 * Gmail send MUST go through submit → approve → apply. Soup lists `email_thread`.
 */
export class MailboxSlice {
  readonly registry = new EntityRegistry();
  readonly access = new AccessStore();
  readonly engine = new PolicyEngine(this.registry, this.access);
  outbox = new Outbox();
  plane = new ProjectionPlane();
  readonly activity = new ActivityLog();
  readonly idempotency = new IdempotencyStore();
  readonly gmail = new InMemoryGmailProvider();
  readonly approval = new MailApprovalQueue();
  readonly sync = new SyncCheckpointStore();
  #accounts = new Map<string, EmailAccount>();
  #mailboxes = new Map<string, MailboxRecord>();
  #threads = new Map<string, EmailThreadRecord>();
  #messages = new Map<string, EmailMessageRecord[]>();
  #byGmailThread = new Map<string, string>();
  #clock = 0;

  openApi(): MailApi {
    return {
      connectAccount: (email, ctx) => this.connectAccount(email, ctx),
      listInbox: (receipts) => this.listInbox(receipts),
      getThread: (threadId, ctx) => this.getThread(threadId, ctx),
      listMessages: (threadId) => this.listMessages(threadId),
      applyPush: (push, ctx) => this.applyPush(push, ctx),
      submitSend: (input, ctx) => this.submitSend(input, ctx),
      approveSend: (actionId, ctx) => this.approveSend(actionId, ctx),
      applySend: (actionId, ctx) => this.applySend(actionId, ctx),
      webhookUrl: (accountId) => gmailHookPath(accountId),
      subscribeLists: (listener) => this.plane.lists.subscribe(listener),
    };
  }

  connectAccount(email: string, ctx: RequestContext): AccountView {
    const tenantId = ctx.actor.actor.tenantId;
    if (!tenantId) throw new MailboxError("denied", "connectAccount requires a tenant-scoped actor");
    const run = () => {
      const accountId = `acct_${this.#now().toString(16).padStart(8, "0")}`;
      const mailboxId = `mbox_${this.#now().toString(16).padStart(8, "0")}`;
      const createdAt = this.#now();
      const account: EmailAccount = {
        id: accountId,
        tenantId,
        ownerId: ctx.actor.actor.id,
        email,
        provider: "gmail",
        createdAt,
      };
      const mailbox: MailboxRecord = {
        id: mailboxId,
        accountId,
        tenantId,
        flavor: "personal",
        address: email,
      };
      this.#accounts.set(accountId, account);
      this.#mailboxes.set(mailboxId, mailbox);
      return { account, mailbox };
    };
    if (ctx.idempotencyKey) return runOnce(this.idempotency, ctx.idempotencyKey, run);
    return run();
  }

  listInbox(receipts: readonly Receipt[]): SoupItem[] {
    return this.plane.lists.query({ types: ["email_thread"] }, receipts).items;
  }

  getThread(threadId: string, ctx: RequestContext): MailThreadView {
    const thread = this.#requireThread(threadId);
    const receipt =
      ctx.receipt && ctx.receipt.entityId === threadId
        ? ctx.receipt
        : this.engine.mint({
            actor: ctx.actor,
            entityType: "email_thread",
            entityId: threadId,
            need: "view",
          });
    requireReceipt(receipt, "view", threadId);
    return { thread, messages: this.listMessages(threadId), receipt };
  }

  listMessages(threadId: string): EmailMessageRecord[] {
    this.#requireThread(threadId);
    return [...(this.#messages.get(threadId) ?? [])];
  }

  applyPush(
    push: PubSubPush,
    ctx: RequestContext,
  ): { applied: number; skipped: number; checkpoint: MailboxSyncCheckpoint } {
    const account = this.#requireAccount(push.accountId);
    const result = this.sync.applyPush(push, this.#now());
    for (const record of result.applied) {
      this.#upsertFromHistory(account, record, ctx);
    }
    return { applied: result.applied.length, skipped: result.skipped.length, checkpoint: result.checkpoint };
  }

  /**
   * Queue a Gmail-API send. Does not call the provider. Instantly is not this path.
   */
  submitSend(input: ComposeInput, ctx: RequestContext): SendProposal {
    this.#requireAccount(input.accountId);
    if (input.threadId) {
      const receipt = this.#receiptForThread(ctx, input.threadId, "edit");
      requireReceipt(receipt, "edit", input.threadId);
    } else if (!ctx.actor.actor.tenantId) {
      throw new MailboxError("denied", "compose requires a tenant-scoped actor");
    }
    return this.approval.submit(input, `Gmail send: ${input.subject}`);
  }

  approveSend(actionId: number, ctx: RequestContext): SendProposal {
    const pending = this.approval.get(actionId);
    if (!pending) throw new MailboxError("unknown_action", `unknown action ${actionId}`);
    if (pending.input.threadId) {
      const receipt = this.#receiptForThread(ctx, pending.input.threadId, "edit");
      requireReceipt(receipt, "edit", pending.input.threadId);
    }
    return this.approval.approve(actionId);
  }

  /**
   * Apply an approved send through the in-memory Gmail adapter. ActivityLog `sent`
   * is the 05-MAP row 8 audit trail. Direct provider send from MailApi is not exposed.
   */
  applySend(actionId: number, ctx: RequestContext): MailThreadView {
    const pending = this.approval.get(actionId);
    if (!pending) throw new MailboxError("unknown_action", `unknown action ${actionId}`);
    if (pending.status !== "approved") {
      throw new MailboxError("not_approved", "action must be approved before apply");
    }
    const account = this.#requireAccount(pending.input.accountId);
    const result = this.gmail.users.messages.send(pending.input);
    pending.result = result;
    this.approval.markApplied(actionId);
    const record: GmailHistoryRecord = {
      gmailMessageId: result.gmailMessageId,
      gmailThreadId: pending.input.threadId
        ? this.#requireThread(pending.input.threadId).gmailThreadId
        : result.gmailThreadId,
      historyId: result.historyId,
      from: account.email,
      to: pending.input.to,
      subject: pending.input.subject,
      body: pending.input.body,
    };
    const thread = this.#upsertFromHistory(account, record, ctx, "outbound");
    this.#audit(thread, ctx, "sent");
    const receipt = this.#receiptForThread(ctx, thread.id, "edit");
    return { thread, messages: this.listMessages(thread.id), receipt };
  }

  getAccount(id: string): EmailAccount | undefined {
    return this.#accounts.get(id);
  }

  getCheckpoint(accountId: string): MailboxSyncCheckpoint | undefined {
    return this.sync.get(accountId);
  }

  get(id: string): EmailThreadRecord | undefined {
    return this.#threads.get(id);
  }

  rebuildProjection(): void {
    this.plane = new ProjectionPlane();
    this.plane.rebuild(this.outbox);
  }

  drain(publish: (env: EventEnvelope) => void = () => undefined): void {
    this.outbox.drain(publish);
    this.plane.ingest(this.outbox);
  }

  /** Explicitly not implemented. Instantly send/activate/start remain forbidden. */
  sendViaInstantly(): never {
    throw new MailboxError(
      "instantly_forbidden",
      "Instantly send/activate/start is forbidden; Gmail send is this node",
    );
  }

  smtpSend(): never {
    return this.gmail.smtpSend();
  }

  #receiptForThread(ctx: RequestContext, threadId: string, need: "view" | "edit"): Receipt {
    if (ctx.receipt && ctx.receipt.entityId === threadId) return ctx.receipt;
    return this.engine.mint({
      actor: ctx.actor,
      entityType: "email_thread",
      entityId: threadId,
      need,
    });
  }

  #upsertFromHistory(
    account: EmailAccount,
    record: GmailHistoryRecord,
    ctx: RequestContext,
    direction: EmailMessageRecord["direction"] = "inbound",
  ): EmailThreadRecord {
    const mailbox = [...this.#mailboxes.values()].find((row) => row.accountId === account.id);
    if (!mailbox) throw new MailboxError("unknown_account", `no mailbox for ${account.id}`);
    let threadId = this.#byGmailThread.get(record.gmailThreadId);
    let thread = threadId ? this.#threads.get(threadId) : undefined;
    const occurredAt = this.#now();
    if (!thread) {
      threadId = nextId("email_thread");
      this.registry.register({
        type: "email_thread",
        id: threadId,
        tenantId: account.tenantId,
        createdAt: occurredAt,
        facet: null,
      });
      this.access.put(threadId, emptyAccess(account.ownerId, account.tenantId));
      thread = {
        id: threadId,
        tenantId: account.tenantId,
        accountId: account.id,
        mailboxId: mailbox.id,
        gmailThreadId: record.gmailThreadId,
        subject: record.subject,
        snippet: record.body.slice(0, 80),
        unread: direction === "inbound",
        done: false,
        version: 1,
        createdAt: occurredAt,
        updatedAt: occurredAt,
      };
      this.#threads.set(threadId, thread);
      this.#byGmailThread.set(record.gmailThreadId, threadId);
      this.#messages.set(threadId, []);
      this.#publish(thread, ctx, "created", record.body);
    } else {
      thread = {
        ...thread,
        subject: record.subject || thread.subject,
        snippet: record.body.slice(0, 80),
        unread: direction === "inbound" ? true : thread.unread,
        version: thread.version + 1,
        updatedAt: occurredAt,
      };
      this.#threads.set(thread.id, thread);
      this.#publish(thread, ctx, "messaged", record.body);
    }
    const message: EmailMessageRecord = {
      id: record.gmailMessageId,
      threadId: thread.id,
      gmailMessageId: record.gmailMessageId,
      gmailThreadId: record.gmailThreadId,
      historyId: record.historyId,
      from: record.from,
      to: record.to,
      cc: [],
      subject: record.subject,
      body: record.body,
      direction,
      createdAt: occurredAt,
    };
    this.#messages.get(thread.id)!.push(message);
    return thread;
  }

  #publish(
    thread: EmailThreadRecord,
    ctx: RequestContext,
    action: Extract<ActivityAction, "created" | "edited" | "messaged" | "sent">,
    body = "",
  ): void {
    const occurredAt = this.#now();
    this.outbox.append(
      envelope({
        topic: "email",
        entityType: "email_thread",
        entityId: thread.id,
        tenantId: thread.tenantId,
        actorId: ctx.actor.actor.id,
        onBehalfOfId: ctx.actor.onBehalfOf?.id ?? null,
        occurredAt,
        version: thread.version,
        payload: {
          title: thread.subject,
          facet: null,
          body,
          unread: thread.unread,
          done: thread.done,
          tombstoned: false,
          createdAt: thread.createdAt,
        },
        receipt: {
          level: ctx.receipt?.level ?? "owner",
          entityType: "email_thread",
          entityId: thread.id,
          actorId: ctx.actor.actor.id,
        },
        correlationId: ctx.correlationId,
      }),
    );
    this.activity.append({
      id: `${action}:${thread.id}:${thread.version}`,
      action,
      entityType: "email_thread",
      entityId: thread.id,
      actorId: ctx.actor.actor.id,
      tenantId: thread.tenantId,
      occurredAt,
    });
    this.drain();
  }

  #audit(thread: EmailThreadRecord, ctx: RequestContext, action: Extract<ActivityAction, "sent">): void {
    this.activity.append({
      id: `${action}:${thread.id}:${thread.version}:write`,
      action,
      entityType: "email_thread",
      entityId: thread.id,
      actorId: ctx.actor.actor.id,
      tenantId: thread.tenantId,
      occurredAt: this.#now(),
    });
  }

  #requireAccount(id: string): EmailAccount {
    const account = this.#accounts.get(id);
    if (!account) throw new MailboxError("unknown_account", `unknown account ${id}`);
    return account;
  }

  #requireThread(id: string): EmailThreadRecord {
    const thread = this.#threads.get(id);
    if (!thread) throw new MailboxError("unknown_thread", `unknown thread ${id}`);
    return thread;
  }

  #now(): number {
    this.#clock += 1;
    return this.#clock;
  }
}

export function actorContext(actor: ActorContext["actor"], kernelUsername = "admin"): ActorContext {
  return { actor, kernelUsername, isDeploymentAdmin: false };
}

export { requestContext, gmailHookPath };
