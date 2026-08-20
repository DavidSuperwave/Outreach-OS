import type { ChannelMessage, RealtimeEvent, RealtimeListener } from "./types.js";

/**
 * In-memory stand-in for one channel Durable Object: a totally-ordered append
 * log with serialized membership changes (04 §7). Sequence numbers are assigned
 * here; reconnect is replay-then-ready (parity:subscription-replay).
 */
export class ChannelMessageLog {
  #seq = 0;
  #events: RealtimeEvent[] = [];
  #messages = new Map<string, ChannelMessage>();
  #order: string[] = [];
  #members = new Set<string>();
  #subscribers = new Map<string, RealtimeListener>();

  constructor(memberIds: readonly string[] = []) {
    for (const id of memberIds) this.#members.add(id);
  }

  get seq(): number {
    return this.#seq;
  }

  get members(): readonly string[] {
    return [...this.#members];
  }

  isMember(actorId: string): boolean {
    return this.#members.has(actorId);
  }

  addMember(actorId: string): void {
    this.#members.add(actorId);
  }

  removeMember(actorId: string): void {
    this.#members.delete(actorId);
  }

  get(id: string): ChannelMessage | undefined {
    return this.#messages.get(id);
  }

  list(): ChannelMessage[] {
    return this.#order.map((id) => this.#messages.get(id)!).filter(Boolean);
  }

  thread(parentId: string): ChannelMessage[] {
    return this.list().filter((row) => row.parentId === parentId);
  }

  append(message: ChannelMessage): ChannelMessage {
    this.#seq += 1;
    const row = { ...message, seq: this.#seq, version: message.version || 1 };
    this.#messages.set(row.id, row);
    this.#order.push(row.id);
    this.#emit({ type: "message", seq: this.#seq, message: row });
    return row;
  }

  edit(id: string, body: string, at: number): ChannelMessage {
    const current = this.#messages.get(id);
    if (!current) throw new Error(`unknown message ${id}`);
    this.#seq += 1;
    const row: ChannelMessage = {
      ...current,
      body,
      edited: true,
      version: current.version + 1,
      updatedAt: at,
    };
    this.#messages.set(id, row);
    this.#emit({ type: "message_edited", seq: this.#seq, message: row });
    return row;
  }

  delete(id: string, at: number): ChannelMessage {
    const current = this.#messages.get(id);
    if (!current) throw new Error(`unknown message ${id}`);
    this.#seq += 1;
    const row: ChannelMessage = { ...current, deleted: true, body: "", updatedAt: at, version: current.version + 1 };
    this.#messages.set(id, row);
    this.#emit({ type: "message_deleted", seq: this.#seq, messageId: id, message: row });
    return row;
  }

  /**
   * Replay events with seq > fromSeq, then `ready()`. Live fan-out starts after ready.
   */
  subscribe(sessionId: string, fromSeq: number, listener: RealtimeListener): () => void {
    const missed = this.#events.filter((event) => event.seq > fromSeq);
    for (const event of missed) listener(event);
    listener({ type: "ready", seq: this.#seq });
    this.#subscribers.set(sessionId, listener);
    return () => {
      this.#subscribers.delete(sessionId);
    };
  }

  replayFrom(fromSeq: number): RealtimeEvent[] {
    return this.#events.filter((event) => event.seq > fromSeq);
  }

  #emit(event: Exclude<RealtimeEvent, { type: "ready" }>): void {
    this.#events.push(event);
    for (const listener of this.#subscribers.values()) listener(event);
  }
}
