import type { EntityType } from "registry";
import type { Receipt } from "../receipt.js";

export type ViewReceipt<T extends EntityType = EntityType> = Receipt<"view", T>;
export type CommentReceipt<T extends EntityType = EntityType> = Receipt<"comment", T>;
export type EditReceipt<T extends EntityType = EntityType> = Receipt<"edit", T>;
export type OwnerReceipt<T extends EntityType = EntityType> = Receipt<"owner", T>;

export { extractBot } from "./bot.js";
export { extractCall } from "./call.js";
export type { CallView } from "./call.js";
export { extractChannel } from "./channel.js";
export type { ChannelComment, ChannelEdit, ChannelOwner } from "./channel.js";
export { extractChat } from "./chat.js";
export type { ChatView, ChatEdit } from "./chat.js";
export { extractDocument } from "./document.js";
export type { DocumentView, DocumentComment, DocumentEdit, DocumentOwner } from "./document.js";
export { extractEntityBody } from "./entity_body.js";
export { extractEntityPermission } from "./entity_permission.js";
export { extractForeignEntity } from "./foreign_entity.js";
export type { ForeignEntityView } from "./foreign_entity.js";
export { extractHistory } from "./history.js";
export { extractPin } from "./pin.js";
export { extractProject } from "./project.js";
export type { ProjectEdit, ProjectView } from "./project.js";
export { extractReminder } from "./reminder.js";
export type { ReminderEdit, ReminderView } from "./reminder.js";
export { extractTeam } from "./team.js";
export type { TeamOwner, TeamEdit, TeamView } from "./team.js";
export { extractThread } from "./thread.js";
export type { EmailThreadView, EmailThreadEdit } from "./thread.js";

/** B2 names — 14 typed extractors. */
export const EXTRACTOR_MODULES = [
  "bot",
  "call",
  "channel",
  "chat",
  "document",
  "entity_body",
  "entity_permission",
  "foreign_entity",
  "history",
  "pin",
  "project",
  "reminder",
  "team",
  "thread",
] as const;

export type ExtractorModuleName = (typeof EXTRACTOR_MODULES)[number];
