import type { EntityType } from "registry";
import type { AccessLevel } from "./levels.js";
import type { Receipt } from "./receipt.js";

/** Compile-time handler obligations — TypeScript recreation of EntityAccessReceipt extractors. */
export type ViewReceipt<T extends EntityType = EntityType> = Receipt<"view", T>;
export type CommentReceipt<T extends EntityType = EntityType> = Receipt<"comment", T>;
export type EditReceipt<T extends EntityType = EntityType> = Receipt<"edit", T>;
export type OwnerReceipt<T extends EntityType = EntityType> = Receipt<"owner", T>;

export type DocumentView = ViewReceipt<"document">;
export type DocumentComment = CommentReceipt<"document">;
export type DocumentEdit = EditReceipt<"document">;
export type DocumentOwner = OwnerReceipt<"document">;
export type ChannelComment = CommentReceipt<"channel">;
export type TeamOwner = OwnerReceipt<"team">;
export type ProjectEdit = EditReceipt<"project">;
export type EmailThreadView = ViewReceipt<"email_thread">;
export type CrmCompanyView = ViewReceipt<"crm_company">;
export type CallView = ViewReceipt<"call">;
export type UserOwner = OwnerReceipt<"user">;
export type ForeignEntityView = ViewReceipt<"foreign_entity">;
export type ReminderEdit = EditReceipt<"reminder">;
export type ChatView = ViewReceipt<"chat">;
