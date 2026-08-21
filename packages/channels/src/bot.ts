/**
 * Channel-bot contract (ledger:46, S7 kept). Wire header names renamed from
 * legacy `x-macro-bot-*` to `x-neuwave-bot-*` per the OD-24 amendment (owner
 * ruling, 2026-08-20); semantics unchanged from the two CF bot workers, which
 * remain the working reference. Do not implement send mail (N11).
 */

/** Wire name (ledger:46 semantics; renamed per OD-24 amendment). */
export const BOT_TOKEN_HEADER = "x-neuwave-bot-token";
/** Wire name (ledger:46 / S7 semantics; renamed per OD-24 amendment). */
export const BOT_SCOPE_HEADER = "x-neuwave-bot-scope";

/** `mbot_<12-hex-prefix>_<64-hex-secret>` (tokens.rs:5-15). */
export const BOT_TOKEN_RE = /^mbot_[0-9a-f]{12}_[0-9a-f]{64}$/;

export const FIXTURE_BOT_TOKEN = `mbot_${"a".repeat(12)}_${"b".repeat(64)}`;
export const FIXTURE_BOT_TOKEN_B = `mbot_${"c".repeat(12)}_${"d".repeat(64)}`;

export type HeaderMap = Record<string, string | undefined>;

export function isBotToken(value: string): boolean {
  return BOT_TOKEN_RE.test(value);
}

export function parseBotToken(value: string): { prefix: string; secret: string } {
  if (!isBotToken(value)) throw new ChannelsError("invalid_bot_token", `malformed mbot token`);
  const [, prefix, secret] = value.split("_") as [string, string, string];
  return { prefix, secret };
}

export function headerValue(headers: HeaderMap | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const direct = headers[name];
  if (direct) return direct;
  const found = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return found?.[1];
}

export type BotOwnerKind = "user" | "team";

/** `owned` XOR ownership CHECK: exactly one of user or team, never both, never neither. */
export type BotOwner =
  | { kind: "user"; userId: string }
  | { kind: "team"; teamId: string };

export function assertBotOwnerXor(input: { userId?: string | null; teamId?: string | null }): BotOwner {
  const userId = input.userId ?? null;
  const teamId = input.teamId ?? null;
  if (Boolean(userId) === Boolean(teamId)) {
    throw new ChannelsError("xor_owner", "bot ownership XOR: exactly one of user or team");
  }
  if (userId) return { kind: "user", userId };
  return { kind: "team", teamId: teamId! };
}

export type PosterKind = "human" | "bot";

export interface PosterAuth {
  kind: PosterKind;
  actorId: string;
  token?: string;
  scope?: string;
}

/**
 * Human session XOR bot token. Supplying both (or neither) is a contract failure.
 * A bot principal in the session without a token header is still the bot path.
 */
export function resolvePosterXor(input: {
  actorKind?: "user" | "team" | "bot" | null;
  actorId?: string | null;
  headers?: HeaderMap;
}): PosterAuth {
  const token = headerValue(input.headers, BOT_TOKEN_HEADER);
  const actorKind = input.actorKind ?? null;
  const humanSession = actorKind === "user" || actorKind === "team";
  const botSession = actorKind === "bot";
  const hasToken = Boolean(token);

  if (humanSession && hasToken) {
    throw new ChannelsError("xor_poster", "human session XOR bot token — not both");
  }
  if (botSession && hasToken && input.actorId && input.actorId !== token) {
    throw new ChannelsError("xor_poster", "bot session id must match x-neuwave-bot-token");
  }
  if (hasToken) {
    if (!isBotToken(token!)) throw new ChannelsError("invalid_bot_token", "malformed mbot token");
    return {
      kind: "bot",
      actorId: token!,
      token,
      scope: headerValue(input.headers, BOT_SCOPE_HEADER),
    };
  }
  if (botSession) {
    if (!input.actorId || !isBotToken(input.actorId)) {
      throw new ChannelsError("invalid_bot_token", "bot principal id must be mbot format");
    }
    return { kind: "bot", actorId: input.actorId, token: input.actorId };
  }
  if (humanSession && input.actorId) {
    return { kind: "human", actorId: input.actorId };
  }
  throw new ChannelsError("xor_poster", "human session XOR bot token — not neither");
}

export function webhookPath(channelId: string): string {
  return `/hooks/channels/${channelId}`;
}

export class ChannelsError extends Error {
  constructor(
    readonly code:
      | "xor_owner"
      | "xor_poster"
      | "invalid_bot_token"
      | "denied"
      | "unknown_channel"
      | "unknown_message"
      | "not_member"
      | "missing_receipt"
      | "send_mail_forbidden",
    message: string,
  ) {
    super(message);
    this.name = "ChannelsError";
  }
}
