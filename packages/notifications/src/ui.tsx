import { Shell } from "shell";
import { N18_UI_DATA_COMMANDS } from "./commands.js";
import type { NotificationRecord } from "./types.js";

export function NotificationList({ items }: { items: readonly NotificationRecord[] }) {
  return (
    <ul data-surface="notifications.list" role="list">
      {items.map((item) => (
        <li
          key={item.id}
          data-notification-id={item.id}
          data-notification-type={item.type}
          data-seen={item.seen ? "true" : "false"}
          data-entity-id={item.entityId}
        >
          <span>{item.title}</span>
          <button type="button" data-command={N18_UI_DATA_COMMANDS[0]} data-notification-id={item.id}>
            Mark seen
          </button>
        </li>
      ))}
    </ul>
  );
}

export function UnreadBadge({ count }: { count: number }) {
  return (
    <span data-unread-count={count} aria-label={`${count} unread notifications`}>
      {count}
    </span>
  );
}

/**
 * List-only chrome. Does not steal mailbox `/inbox` (N11). Shell path is `/`
 * (home split) so notifications ride fixture-friendly home chrome.
 */
export function NotificationWorkspace({
  items,
  unreadCount,
}: {
  items: readonly NotificationRecord[];
  unreadCount: number;
}) {
  return (
    <div data-slice="notifications">
      <Shell path="/" panes={[{ type: "home", id: "_" }]} theme="outreach-dark">
        <UnreadBadge count={unreadCount} />
        <NotificationList items={items} />
      </Shell>
    </div>
  );
}
