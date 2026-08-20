import { Shell } from "shell";
import type { ActivityView, FavoriteView, RecentsView } from "./types.js";

export function MyActivityList({ items }: { items: readonly ActivityView[] }) {
  return (
    <ul data-surface="activity.mine" role="list">
      {items.map((item) => (
        <li key={item.id} data-entity-id={item.entityId} data-action={item.action}>
          {item.action} {item.entityId}
        </li>
      ))}
    </ul>
  );
}

export function RecentsList({ items }: { items: readonly RecentsView[] }) {
  return (
    <ul data-surface="activity.frecency" role="list">
      {items.map((item) => (
        <li key={item.entityId} data-entity-id={item.entityId} data-score={String(item.score)}>
          {item.entityId}
        </li>
      ))}
    </ul>
  );
}

export function FavoritesList({ items }: { items: readonly FavoriteView[] }) {
  return (
    <ul data-surface="favorites.list" role="list">
      {items.map((item) => (
        <li
          key={item.entityId}
          data-entity-id={item.entityId}
          data-entity-type={item.entityType}
          data-command="favorites.open.<favorite>"
        >
          {item.title}
        </li>
      ))}
    </ul>
  );
}

export function ActivityWorkspace({
  mine,
  recents,
  favorites,
}: {
  mine: readonly ActivityView[];
  recents: readonly RecentsView[];
  favorites: readonly FavoriteView[];
}) {
  return (
    <div data-slice="activity" data-path-route="/activity">
      <Shell path="/activity" panes={[{ type: "home", id: "_" }]} theme="outreach-dark" />
      <MyActivityList items={mine} />
      <RecentsList items={recents} />
      <FavoritesList items={favorites} />
      <button type="button" data-command="soup-entity.favorite">
        Favorite
      </button>
    </div>
  );
}
