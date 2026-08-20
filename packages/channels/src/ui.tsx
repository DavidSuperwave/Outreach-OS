import type { SoupItem } from "soup/browser";
import { Shell } from "shell";
import type { ChannelMessage } from "./types.js";
import type { PresenceSnapshot } from "./presence.js";

export function ChannelComposePopover({ open, title }: { open: boolean; title: string }) {
  if (!open) return null;
  return (
    <form data-scope="channel-compose-popover" data-command="create-menu.channel">
      <label>
        Title
        <input name="title" defaultValue={title} aria-label="Channel title" />
      </label>
      <button type="submit">Create channel</button>
    </form>
  );
}

export function ChannelList({ items }: { items: readonly SoupItem[] }) {
  return (
    <ul data-surface="soup.channels" role="list">
      {items.map((item) => (
        <li
          key={item.entityId}
          data-entity-id={item.entityId}
          data-entity-type={item.entityType}
        >
          {item.title}
        </li>
      ))}
    </ul>
  );
}

export function MessageLog({ messages }: { messages: readonly ChannelMessage[] }) {
  return (
    <ol data-surface="channel.messages" data-command="channel.go-to-latest">
      {messages.map((message) => (
        <li
          key={message.id}
          data-message-id={message.id}
          data-seq={message.seq}
          data-sender-kind={message.senderKind}
          data-parent-id={message.parentId ?? ""}
        >
          {message.deleted ? "(deleted)" : message.body}
        </li>
      ))}
    </ol>
  );
}

export function PresenceStrip({ snapshot }: { snapshot: PresenceSnapshot | null }) {
  if (!snapshot) return null;
  return (
    <p data-surface="channel.presence" data-track-path={snapshot.trackPath}>
      {snapshot.sessions.map((row) => row.actorId).join(", ") || "empty"}
    </p>
  );
}

export function ChannelFindBar({ open }: { open: boolean }) {
  if (!open) return null;
  return (
    <form data-scope="channel-find" data-command="channel.find">
      <input aria-label="Find in channel" name="q" />
    </form>
  );
}

export function ChannelWorkspace({
  items,
  messages,
  presence,
  composeOpen,
  draft,
  findOpen,
}: {
  items: readonly SoupItem[];
  messages: readonly ChannelMessage[];
  presence?: PresenceSnapshot | null;
  composeOpen: boolean;
  draft: string;
  findOpen?: boolean;
}) {
  return (
    <div data-slice="channels">
      <Shell path="/channels" panes={[{ type: "channel", id: "_" }]} theme="outreach-dark" />
      <ChannelComposePopover open={composeOpen} title={draft} />
      <ChannelFindBar open={findOpen ?? false} />
      <ChannelList items={items} />
      <MessageLog messages={messages} />
      <PresenceStrip snapshot={presence ?? null} />
    </div>
  );
}
