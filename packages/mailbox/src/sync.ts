import type { GmailHistoryRecord, MailboxSyncCheckpoint, PubSubPush } from "./types.js";

export interface AppliedHistory {
  applied: GmailHistoryRecord[];
  skipped: GmailHistoryRecord[];
  checkpoint: MailboxSyncCheckpoint;
}

/**
 * Pub/Sub push sync: store cursor, apply incoming history, skip duplicates.
 * Ingress path is `/hooks/gmail/{accountId}` (C2 HTTP exception).
 */
export class SyncCheckpointStore {
  #cursors = new Map<string, MailboxSyncCheckpoint>();
  #seen = new Set<string>();

  get(accountId: string): MailboxSyncCheckpoint | undefined {
    return this.#cursors.get(accountId);
  }

  seen(gmailMessageId: string): boolean {
    return this.#seen.has(gmailMessageId);
  }

  applyPush(push: PubSubPush, now: number): AppliedHistory {
    const applied: GmailHistoryRecord[] = [];
    const skipped: GmailHistoryRecord[] = [];
    for (const record of push.records) {
      if (this.#seen.has(record.gmailMessageId)) {
        skipped.push(record);
        continue;
      }
      this.#seen.add(record.gmailMessageId);
      applied.push(record);
    }
    const checkpoint: MailboxSyncCheckpoint = {
      accountId: push.accountId,
      historyId: push.historyId,
      updatedAt: now,
    };
    this.#cursors.set(push.accountId, checkpoint);
    return { applied, skipped, checkpoint };
  }
}

export function gmailHookPath(accountId: string): string {
  return `/hooks/gmail/${accountId}`;
}
