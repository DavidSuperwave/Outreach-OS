// Browser-safe exports for UI fixtures. Node crypto (uuidv5 / slice) stays off this path.
export { ActivityWorkspace, MyActivityList, RecentsList, FavoritesList } from "./ui.js";
export { ACTIVITY_COMMAND_IDS, N17_PARITY_COMMAND_IDS } from "./commands.js";
export type { ActivityCommandId, N17ParityCommandId } from "./commands.js";
export {
  RECENTS_DELETED_HTTP,
  MS_PER_HOUR,
  FREQUENCY_PERCENT,
  RECENCY_PERCENT,
  RECENCY_DECAY_RATE,
  MAX_RECENT_EVENTS,
} from "./types.js";
export type { ActivityView, RecentsView, FavoriteView } from "./types.js";
