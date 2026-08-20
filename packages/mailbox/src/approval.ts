import { MailboxError } from "./errors.js";
import type { ComposeInput, SendProposal } from "./types.js";

/** In-process ApprovalQueue stand-in for 05-MAP row 8. Kernel Overseer owns the real one. */
export class MailApprovalQueue {
  readonly actions = new Map<number, SendProposal>();
  #nextId = 0;

  submit(input: ComposeInput, description: string): SendProposal {
    this.#nextId += 1;
    const row: SendProposal = {
      actionId: this.#nextId,
      description,
      status: "pending",
      input,
      result: null,
    };
    this.actions.set(row.actionId, row);
    return row;
  }

  approve(actionId: number): SendProposal {
    const row = this.#require(actionId);
    if (row.status !== "pending") {
      throw new MailboxError("denied", `action ${actionId} is ${row.status}, not pending`);
    }
    row.status = "approved";
    return row;
  }

  reject(actionId: number): SendProposal {
    const row = this.#require(actionId);
    row.status = "rejected";
    return row;
  }

  markApplied(actionId: number): SendProposal {
    const row = this.#require(actionId);
    if (row.status !== "approved") {
      throw new MailboxError("not_approved", "action must be approved before apply");
    }
    row.status = "applied";
    return row;
  }

  get(actionId: number): SendProposal | undefined {
    return this.actions.get(actionId);
  }

  #require(actionId: number): SendProposal {
    const row = this.actions.get(actionId);
    if (!row) throw new MailboxError("unknown_action", `unknown action ${actionId}`);
    return row;
  }
}
