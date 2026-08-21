/** Complete AI-spend inventory (ledger:62, exactly 10). */
export const AI_FEATURES = [
  "Chat",
  "Memory",
  "Automation",
  "DynamicCompletionsApi",
  "ChatRename",
  "CallSummary",
  "ChannelBot",
  "AiProjection",
  "AiEditing",
  "Import",
] as const;

export type AiFeature = (typeof AI_FEATURES)[number];

export interface AiUsageEvent {
  feature: AiFeature
  ownerId: string
  model: string
  promptTokens: number
  completionTokens: number
  at: number
}

export class AiUsageLedger {
  #rows: AiUsageEvent[] = [];

  record(event: AiUsageEvent): void {
    this.#rows.push(event);
  }

  rollup(feature?: AiFeature): { events: number; promptTokens: number; completionTokens: number } {
    const rows = feature ? this.#rows.filter((row) => row.feature === feature) : this.#rows;
    return {
      events: rows.length,
      promptTokens: rows.reduce((sum, row) => sum + row.promptTokens, 0),
      completionTokens: rows.reduce((sum, row) => sum + row.completionTokens, 0),
    };
  }

  all(): readonly AiUsageEvent[] {
    return this.#rows;
  }
}
