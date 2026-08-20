import { createHash } from "node:crypto";
import { CalendarError } from "./errors.js";

/**
 * In-memory transcription sidecar. Ingest is an internal queue/service binding,
 * not public HTTP (04 §9). Transcript attaches to exactly one call record.
 */
export interface TranscriptRecord {
  id: string;
  callId: string;
  body: string;
  sha: string;
  createdAt: number;
}

export function transcriptSha(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

export class TranscriptSidecar {
  #byCall = new Map<string, TranscriptRecord>();
  #seq = 0;

  attach(callId: string, body: string, createdAt: number): TranscriptRecord {
    if (this.#byCall.has(callId)) {
      throw new CalendarError("transcript_attached", `transcript already attached to ${callId}`);
    }
    this.#seq += 1;
    const record: TranscriptRecord = {
      id: `trn_${this.#seq.toString(16).padStart(32, "0")}`,
      callId,
      body,
      sha: transcriptSha(body),
      createdAt,
    };
    this.#byCall.set(callId, record);
    return record;
  }

  get(callId: string): TranscriptRecord | undefined {
    return this.#byCall.get(callId);
  }

  require(callId: string): TranscriptRecord {
    const record = this.#byCall.get(callId);
    if (!record) throw new CalendarError("unknown_call", `no transcript for ${callId}`);
    return record;
  }
}
