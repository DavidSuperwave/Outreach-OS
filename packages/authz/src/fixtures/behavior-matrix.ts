import type { EntityType } from "registry";
import type { AccessLevel } from "../levels.js";
import type { QueryModuleName } from "../queries/index.js";

export type MatrixActor = "owner" | "teammate" | "outsider" | "bot";

export type MatrixSetup =
  | "owner-only"
  | "comment-share"
  | "edit-share"
  | "channel-member"
  | "channel-admin"
  | "inbox-delegate"
  | "email-link"
  | "project-inherit"
  | "crm-member"
  | "crm-admin"
  | "call-in-channel"
  | "team-admin"
  | "team-member"
  | "assignee"
  | "bot-token"
  | "on-behalf-of-comment";

export interface BehaviorCell {
  /** Harvest source: query module or the 05-MAP document/task proof. */
  module: QueryModuleName | "document_task" | "user" | "calendar_event" | "static_file" | "reminder" | "skill";
  name: string;
  entityType: EntityType;
  facet?: "task" | null;
  actor: MatrixActor;
  need: AccessLevel;
  setup: MatrixSetup;
  expect: "allow" | "deny";
}

/**
 * Harvested entity_access behavior matrix (13.5k LOC tests → table-driven cells).
 * Source crate is not in this repo; cells re-express OD-7, 04-TARGET, and B3 query semantics.
 * 05-MAP row 2 is the document/task owner × share × outsider lattice.
 */
export const BEHAVIOR_MATRIX: BehaviorCell[] = [
  // --- 05-MAP row 2: task-facet document ---
  { module: "document_task", name: "owner×view", entityType: "document", facet: "task", actor: "owner", need: "view", setup: "owner-only", expect: "allow" },
  { module: "document_task", name: "owner×comment", entityType: "document", facet: "task", actor: "owner", need: "comment", setup: "owner-only", expect: "allow" },
  { module: "document_task", name: "owner×edit", entityType: "document", facet: "task", actor: "owner", need: "edit", setup: "owner-only", expect: "allow" },
  { module: "document_task", name: "owner×owner", entityType: "document", facet: "task", actor: "owner", need: "owner", setup: "owner-only", expect: "allow" },
  { module: "document_task", name: "comment-share×view", entityType: "document", facet: "task", actor: "teammate", need: "view", setup: "comment-share", expect: "allow" },
  { module: "document_task", name: "comment-share×comment", entityType: "document", facet: "task", actor: "teammate", need: "comment", setup: "comment-share", expect: "allow" },
  { module: "document_task", name: "comment-share×edit", entityType: "document", facet: "task", actor: "teammate", need: "edit", setup: "comment-share", expect: "deny" },
  { module: "document_task", name: "comment-share×owner", entityType: "document", facet: "task", actor: "teammate", need: "owner", setup: "comment-share", expect: "deny" },
  { module: "document_task", name: "outsider×view", entityType: "document", facet: "task", actor: "outsider", need: "view", setup: "owner-only", expect: "deny" },
  { module: "document_task", name: "outsider×comment", entityType: "document", facet: "task", actor: "outsider", need: "comment", setup: "owner-only", expect: "deny" },
  { module: "document_task", name: "outsider×edit", entityType: "document", facet: "task", actor: "outsider", need: "edit", setup: "owner-only", expect: "deny" },
  { module: "document_task", name: "outsider×owner", entityType: "document", facet: "task", actor: "outsider", need: "owner", setup: "owner-only", expect: "deny" },
  { module: "document_task", name: "edit-share satisfies view", entityType: "document", facet: "task", actor: "teammate", need: "view", setup: "edit-share", expect: "allow" },
  { module: "document_access", name: "assignee gains edit", entityType: "document", facet: "task", actor: "teammate", need: "edit", setup: "assignee", expect: "allow" },
  { module: "document_access", name: "assignee is not owner", entityType: "document", facet: "task", actor: "teammate", need: "owner", setup: "assignee", expect: "deny" },

  // --- team_access ---
  { module: "team_access", name: "owner has owner", entityType: "team", actor: "owner", need: "owner", setup: "owner-only", expect: "allow" },
  { module: "team_access", name: "admin has edit", entityType: "team", actor: "teammate", need: "edit", setup: "team-admin", expect: "allow" },
  { module: "team_access", name: "admin is not owner", entityType: "team", actor: "teammate", need: "owner", setup: "team-admin", expect: "deny" },
  { module: "team_access", name: "member has view", entityType: "team", actor: "teammate", need: "view", setup: "team-member", expect: "allow" },
  { module: "team_access", name: "member cannot edit", entityType: "team", actor: "teammate", need: "edit", setup: "team-member", expect: "deny" },
  { module: "team_access", name: "outsider denied", entityType: "team", actor: "outsider", need: "view", setup: "owner-only", expect: "deny" },

  // --- channel_membership / channel_role ---
  { module: "channel_membership", name: "member comments", entityType: "channel", actor: "teammate", need: "comment", setup: "channel-member", expect: "allow" },
  { module: "channel_membership", name: "member cannot own", entityType: "channel", actor: "teammate", need: "owner", setup: "channel-member", expect: "deny" },
  { module: "channel_membership", name: "outsider denied", entityType: "channel", actor: "outsider", need: "view", setup: "channel-member", expect: "deny" },
  { module: "channel_role", name: "admin edits", entityType: "channel", actor: "teammate", need: "edit", setup: "channel-admin", expect: "allow" },
  { module: "channel_role", name: "admin is not owner", entityType: "channel", actor: "teammate", need: "owner", setup: "channel-admin", expect: "deny" },
  { module: "channel_membership", name: "bot token comments", entityType: "channel", actor: "bot", need: "comment", setup: "bot-token", expect: "allow" },

  // --- chat / foreign ---
  { module: "chat_access", name: "owner views chat", entityType: "chat", actor: "owner", need: "view", setup: "owner-only", expect: "allow" },
  { module: "chat_access", name: "outsider denied", entityType: "chat", actor: "outsider", need: "view", setup: "owner-only", expect: "deny" },
  { module: "foreign_entity_access", name: "owner views foreign", entityType: "foreign_entity", actor: "owner", need: "view", setup: "owner-only", expect: "allow" },
  { module: "foreign_entity_access", name: "outsider denied", entityType: "foreign_entity", actor: "outsider", need: "view", setup: "owner-only", expect: "deny" },

  // --- project inheritance ---
  { module: "project_access", name: "owner edits project", entityType: "project", actor: "owner", need: "edit", setup: "owner-only", expect: "allow" },
  { module: "project_access", name: "child inherits parent comment", entityType: "project", actor: "teammate", need: "comment", setup: "project-inherit", expect: "allow" },
  { module: "project_access", name: "child inherit cannot own", entityType: "project", actor: "teammate", need: "owner", setup: "project-inherit", expect: "deny" },
  { module: "project_access", name: "outsider denied", entityType: "project", actor: "outsider", need: "view", setup: "owner-only", expect: "deny" },

  // --- thread ---
  { module: "thread_access", name: "owner views thread", entityType: "email_thread", actor: "owner", need: "view", setup: "owner-only", expect: "allow" },
  { module: "thread_access", name: "inbox delegate edits", entityType: "email_thread", actor: "teammate", need: "edit", setup: "inbox-delegate", expect: "allow" },
  { module: "thread_access", name: "email_link edits", entityType: "email_thread", actor: "teammate", need: "edit", setup: "email-link", expect: "allow" },
  { module: "thread_access", name: "delegate is not owner", entityType: "email_thread", actor: "teammate", need: "owner", setup: "inbox-delegate", expect: "deny" },
  { module: "thread_access", name: "outsider denied", entityType: "email_thread", actor: "outsider", need: "view", setup: "owner-only", expect: "deny" },

  // --- call ---
  { module: "call_access", name: "owner views call", entityType: "call", actor: "owner", need: "view", setup: "owner-only", expect: "allow" },
  { module: "call_access", name: "outsider denied", entityType: "call", actor: "outsider", need: "view", setup: "owner-only", expect: "deny" },
  { module: "call_channel", name: "channel member views call", entityType: "call", actor: "teammate", need: "view", setup: "call-in-channel", expect: "allow" },
  { module: "call_channel", name: "channel member cannot edit call", entityType: "call", actor: "teammate", need: "edit", setup: "call-in-channel", expect: "deny" },

  // --- CRM ---
  { module: "crm_company_access", name: "owner owns company", entityType: "crm_company", actor: "owner", need: "owner", setup: "owner-only", expect: "allow" },
  { module: "crm_company_access", name: "team member views company", entityType: "crm_company", actor: "teammate", need: "view", setup: "crm-member", expect: "allow" },
  { module: "crm_company_access", name: "team member cannot edit", entityType: "crm_company", actor: "teammate", need: "edit", setup: "crm-member", expect: "deny" },
  { module: "crm_company_access", name: "team admin edits company", entityType: "crm_company", actor: "teammate", need: "edit", setup: "crm-admin", expect: "allow" },
  { module: "crm_company_access", name: "outsider denied", entityType: "crm_company", actor: "outsider", need: "view", setup: "owner-only", expect: "deny" },
  { module: "crm_contact_access", name: "team member views contact", entityType: "crm_contact", actor: "teammate", need: "view", setup: "crm-member", expect: "allow" },
  { module: "crm_contact_access", name: "outsider denied", entityType: "crm_contact", actor: "outsider", need: "view", setup: "owner-only", expect: "deny" },

  // --- remaining types ---
  { module: "user", name: "self owner", entityType: "user", actor: "owner", need: "owner", setup: "owner-only", expect: "allow" },
  { module: "user", name: "other user denied", entityType: "user", actor: "teammate", need: "view", setup: "owner-only", expect: "deny" },
  { module: "calendar_event", name: "owner views event", entityType: "calendar_event", actor: "owner", need: "view", setup: "owner-only", expect: "allow" },
  { module: "calendar_event", name: "outsider denied", entityType: "calendar_event", actor: "outsider", need: "view", setup: "owner-only", expect: "deny" },
  { module: "reminder", name: "owner views reminder", entityType: "reminder", actor: "owner", need: "view", setup: "owner-only", expect: "allow" },
  { module: "skill", name: "owner views skill", entityType: "skill", actor: "owner", need: "view", setup: "owner-only", expect: "allow" },
  { module: "static_file", name: "owner views file", entityType: "static_file", actor: "owner", need: "view", setup: "owner-only", expect: "allow" },
  {
    module: "document_access",
    name: "on_behalf_of uses subject access",
    entityType: "document",
    facet: "task",
    actor: "outsider",
    need: "comment",
    setup: "on-behalf-of-comment",
    expect: "allow",
  },
];
