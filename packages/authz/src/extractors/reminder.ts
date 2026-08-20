import type { AccessLevel } from "../levels.js";
import type { Receipt } from "../receipt.js";
import { extractTyped } from "./common.js";

export type ReminderEdit = Receipt<"edit", "reminder">;
export type ReminderView = Receipt<"view", "reminder">;

export function extractReminder<L extends AccessLevel>(
  receipt: Receipt,
  need: L,
  entityId: string,
): Receipt<L, "reminder"> {
  return extractTyped("reminder", receipt, need, entityId);
}
