import { ConnectivityError } from "./errors.js";
import { type AiFeature, type AiUsageLedger } from "./ai-usage.js";

export const COMPLETIONS_PATH = "/chat/completions";
export const DEFAULT_MODEL_ALLOW_LIST = ["gpt-4o-mini", "gpt-4.1-mini"] as const;

export interface CompletionsRequest {
  model: string
  messages: { role: string; content: string }[]
  stream?: boolean
}

export interface CompletionsGovernance {
  ownerId: string
  feature: AiFeature
  allowList: readonly string[]
  enabled: boolean
  hasChatModelAccess: boolean
}

export interface CompletionsResponse {
  id: string
  model: string
  stream: false
  choices: { message: { role: "assistant"; content: string } }[]
  usage: { promptTokens: number; completionTokens: number }
}

export class CompletionsGateway {
  killSwitch = false;
  #seq = 0;

  constructor(
    private readonly usage: AiUsageLedger,
    private readonly transport: (req: CompletionsRequest) => Promise<string>,
  ) {}

  disable(): void {
    this.killSwitch = true;
  }

  enable(): void {
    this.killSwitch = false;
  }

  async complete(request: CompletionsRequest, gov: CompletionsGovernance, now = Date.now()): Promise<CompletionsResponse> {
    if (this.killSwitch || !gov.enabled) {
      throw new ConnectivityError("kill_switch", "completions passthrough is disabled");
    }
    if (!gov.hasChatModelAccess) throw new ConnectivityError("denied", "ChatModelAccess required");
    if (!gov.allowList.includes(request.model)) {
      throw new ConnectivityError("model_not_allowed", `model ${request.model} is not allow-listed`);
    }
    const normalized: CompletionsRequest = { ...request, stream: false };
    const content = await this.transport(normalized);
    this.#seq += 1;
    const promptTokens = normalized.messages.reduce((sum, msg) => sum + msg.content.split(/\s+/).length, 0);
    const completionTokens = content.split(/\s+/).length;
    this.usage.record({
      feature: gov.feature,
      ownerId: gov.ownerId,
      model: normalized.model,
      promptTokens,
      completionTokens,
      at: now,
    });
    return {
      id: `cmpl_${this.#seq}`,
      model: normalized.model,
      stream: false,
      choices: [{ message: { role: "assistant", content } }],
      usage: { promptTokens, completionTokens },
    };
  }
}
