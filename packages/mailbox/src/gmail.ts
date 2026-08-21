import { MailboxError } from "./errors.js";
import type { ComposeInput, GmailHistoryRecord, GmailSendResult } from "./types.js";

/**
 * In-memory Gmail API adapter. Never calls live Gmail. No SMTP.
 * `users.messages.send` is the only egress; callers must still go through the
 * mailbox approval queue before invoking it.
 */
export class InMemoryGmailProvider {
  readonly sent: GmailSendResult[] = [];
  readonly history: GmailHistoryRecord[] = [];
  #messageSeq = 0;
  #historySeq = 0;

  users = {
    messages: {
      send: (input: ComposeInput): GmailSendResult => this.send(input),
    },
    history: {
      list: (startHistoryId: string): GmailHistoryRecord[] => this.listHistory(startHistoryId),
    },
  };

  send(input: ComposeInput): GmailSendResult {
    this.#messageSeq += 1;
    this.#historySeq += 1;
    const result: GmailSendResult = {
      gmailMessageId: `gmail_msg_${this.#messageSeq}`,
      gmailThreadId: input.threadId ? `gmail_th_${input.threadId}` : `gmail_th_${this.#messageSeq}`,
      historyId: String(this.#historySeq),
    };
    this.sent.push(result);
    this.history.push({
      gmailMessageId: result.gmailMessageId,
      gmailThreadId: result.gmailThreadId,
      historyId: result.historyId,
      from: "me",
      to: input.to,
      subject: input.subject,
      body: input.body,
    });
    return result;
  }

  seedHistory(records: readonly GmailHistoryRecord[]): void {
    for (const record of records) {
      this.history.push(record);
      const parsed = Number(record.historyId);
      if (Number.isFinite(parsed) && parsed > this.#historySeq) this.#historySeq = parsed;
    }
  }

  listHistory(startHistoryId: string): GmailHistoryRecord[] {
    const start = Number(startHistoryId);
    return this.history.filter((row) => Number(row.historyId) > start);
  }

  smtpSend(): never {
    throw new MailboxError("smtp_forbidden", "N11 send is Gmail API only; SMTP is forbidden");
  }

  liveFetch(): never {
    throw new MailboxError("live_gmail_forbidden", "in-memory provider does not call live Gmail");
  }
}
