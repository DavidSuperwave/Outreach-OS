import type { SoupItem } from "soup/browser";
import { Shell } from "shell";
import type { EmailMessageRecord, EmailThreadRecord } from "./types.js";

export function MailComposePopover({ open, subject }: { open: boolean; subject: string }) {
  if (!open) return null;
  return (
    <form data-scope="compose-email" data-command="email.compose.send">
      <label>
        To
        <input name="to" aria-label="To" data-command="email.compose.edit-to" />
      </label>
      <label>
        Subject
        <input name="subject" defaultValue={subject} aria-label="Subject" data-command="email.compose.edit-subject" />
      </label>
      <label>
        Message
        <textarea name="body" aria-label="Message" data-command="email.compose.edit-message" />
      </label>
      <button type="submit" data-command="email.send">
        Send
      </button>
    </form>
  );
}

export function InboxList({ items }: { items: readonly SoupItem[] }) {
  return (
    <ul data-surface="soup.mail" role="list">
      {items.map((item) => (
        <li
          key={item.entityId}
          data-entity-id={item.entityId}
          data-entity-type={item.entityType}
          data-unread={item.unread ? "true" : "false"}
        >
          {item.title}
        </li>
      ))}
    </ul>
  );
}

export function ThreadView({
  thread,
  messages,
}: {
  thread: EmailThreadRecord | null;
  messages: readonly EmailMessageRecord[];
}) {
  if (!thread) return null;
  return (
    <article data-surface="email.thread" data-thread-id={thread.id} data-command="thread.enter">
      <h2>{thread.subject}</h2>
      <ol data-surface="email.messages">
        {messages.map((message) => (
          <li
            key={message.id}
            data-message-id={message.id}
            data-direction={message.direction}
            data-gmail-message-id={message.gmailMessageId}
          >
            {message.body}
          </li>
        ))}
      </ol>
    </article>
  );
}

export function MailboxWorkspace({
  items,
  thread,
  messages,
  composeOpen,
  draft,
  path = "/mail",
}: {
  items: readonly SoupItem[];
  thread?: EmailThreadRecord | null;
  messages?: readonly EmailMessageRecord[];
  composeOpen: boolean;
  draft: string;
  path?: "/mail" | "/inbox";
}) {
  const pane = path === "/inbox" ? { type: "inbox" as const, id: "_" } : { type: "email" as const, id: "_" };
  return (
    <div data-slice="mailbox">
      <Shell path={path} panes={[pane]} theme="outreach-dark" />
      <MailComposePopover open={composeOpen} subject={draft} />
      <InboxList items={items} />
      <ThreadView thread={thread ?? null} messages={messages ?? []} />
    </div>
  );
}
