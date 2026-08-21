import { describe, expect, it } from "vitest";
import {
  attachTaskSubscribe,
  taskSubscribeUrl,
  type TaskSubscribeSocket,
} from "./live-session.js";

class FakeSocket implements TaskSubscribeSocket {
  readonly listeners = new Map<string, Array<(event: { data?: unknown }) => void>>();

  addEventListener(type: "message" | "close" | "error", listener: (event: { data?: unknown }) => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  close(): void {
    for (const listener of this.listeners.get("close") ?? []) listener({});
  }
}

async function until(predicate: () => boolean, label: string): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > 1000) throw new Error(label);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

describe("task subscribe reconnect", () => {
  it("encodes cursor, one-use ticket, and tenant without the kernel token", () => {
    const url = taskSubscribeUrl("ws://host/subscribe", 4, "ticket-1", "team_1");
    expect(url).toBe(
      "ws://host/subscribe?cursor=4&ticket=ticket-1&tenant=team_1",
    );
    expect(url).not.toContain("bob%3Asecret");
    expect(url).not.toContain("token=");
  });

  it("replays missed deltas then reopens after the socket drops", async () => {
    const sockets: FakeSocket[] = [];
    const replayed: number[] = [];
    let deltas = 0;
    const session = {
      seq: async () => 3,
      createSubscribeTicket: async () => ({
        ticket: `ticket-${sockets.length + 1}`,
        expiresAt: Date.now() + 30_000,
      }),
      replayFrom: async (from: number) => {
        replayed.push(from);
        return from < 4 ? [{ seq: 4 }] : [];
      },
    } as unknown as Parameters<typeof attachTaskSubscribe>[0]["session"];
    const sub = attachTaskSubscribe({
      open: (url) => {
        expect(url).toContain("cursor=3");
        expect(url).toContain(`ticket=ticket-${sockets.length + 1}`);
        expect(url).toContain("tenant=team_1");
        expect(url).not.toContain("token=");
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
      subscribePath: "ws://example/subscribe",
      tenant: "team_1",
      session,
      onDelta: () => {
        deltas += 1;
      },
    });
    await until(() => sockets.length === 1, "first subscribe socket");
    sockets[0]?.close();
    await until(() => sockets.length === 2, "reconnect subscribe socket");
    expect(replayed).toEqual([3]);
    expect(deltas).toBe(1);
    sub.close();
  });
});
