import { ConnectivityError } from "./errors.js";
import type { Observation, ObservationAuthorizer } from "./instantly.js";
import type { GitHubWriteProposal } from "./github.js";

export type ActionStatus = "pending" | "approved" | "rejected" | "applied";

export interface QueuedAction {
  actionId: number
  description: string
  status: ActionStatus
  proposal: GitHubWriteProposal
}

/** In-process ApprovalQueue stand-in for 05-MAP row 14. Kernel Overseer owns the real one. */
export class SessionApprovalQueue implements ObservationAuthorizer {
  readonly observations: Observation[] = [];
  readonly actions = new Map<number, QueuedAction>();

  async authorizeObservation(observation: Observation): Promise<void> {
    this.observations.push(observation);
  }

  submitAction(proposal: GitHubWriteProposal, description: string): QueuedAction {
    const row: QueuedAction = {
      actionId: proposal.actionId,
      description,
      status: "pending",
      proposal,
    };
    this.actions.set(proposal.actionId, row);
    return row;
  }

  approve(actionId: number): QueuedAction {
    const row = this.#require(actionId);
    row.status = "approved";
    return row;
  }

  reject(actionId: number): QueuedAction {
    const row = this.#require(actionId);
    row.status = "rejected";
    return row;
  }

  markApplied(actionId: number): QueuedAction {
    const row = this.#require(actionId);
    if (row.status !== "approved") {
      throw new ConnectivityError("denied", "action must be approved before apply");
    }
    row.status = "applied";
    return row;
  }

  #require(actionId: number): QueuedAction {
    const row = this.actions.get(actionId);
    if (!row) throw new ConnectivityError("unknown_connector", `unknown action ${actionId}`);
    return row;
  }
}
