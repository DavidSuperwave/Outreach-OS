import type { EventEnvelope } from "control-plane";
import { Outbox } from "control-plane";
import type { SchemaFamilyName } from "./schemas.js";

/** One family on the shared projection plane. Apply is idempotent by entity id + version. */
export interface ProjectionFamily {
  readonly family: SchemaFamilyName;
  readonly checkpoint: string;
  apply(envelope: EventEnvelope): unknown;
}

/**
 * Shared consumer framework (OD-27). One outbox feed, independent per-family
 * checkpoints, same apply/replay contract. Physical Queues land in 4a.
 */
export class ProjectionConsumer {
  constructor(readonly families: readonly ProjectionFamily[]) {
    if (this.families.length === 0) throw new Error("projection consumer needs a family");
  }

  ingest(outbox: Outbox): number {
    let applied = 0;
    for (const family of this.families) {
      const from = outbox.getCheckpoint(family.checkpoint)?.lastEventId;
      applied += this.#applyBatch(outbox, family, outbox.replay(from));
    }
    return applied;
  }

  /** Drop-and-rebuild: replay every non-poison envelope onto empty family state. */
  rebuild(outbox: Outbox): number {
    let applied = 0;
    for (const family of this.families) {
      applied += this.#applyBatch(outbox, family, outbox.replay());
    }
    return applied;
  }

  #applyBatch(outbox: Outbox, family: ProjectionFamily, batch: ReturnType<Outbox["replay"]>): number {
    for (const next of batch) family.apply(next);
    if (batch.length > 0) {
      const last = batch[batch.length - 1]!;
      outbox.checkpoint(family.checkpoint, last.eventId, last.version);
    }
    return batch.length;
  }
}
