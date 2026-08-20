import { ENTITY_TYPES, type EntityType } from "registry";
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
  | "on-behalf-of-comment"
  | "membership-without-share"
  | "chat-participant"
  | "call-participant";

export interface BehaviorCell {
  module: QueryModuleName | "document_task" | "user" | "calendar_event" | "static_file" | "reminder" | "skill";
  name: string;
  entityType: EntityType;
  facet?: "task" | null;
  actor: MatrixActor;
  need: AccessLevel;
  setup: MatrixSetup;
  expect: "allow" | "deny";
  kind?: "mint" | "list";
}

const LEVELS: AccessLevel[] = ["view", "comment", "edit", "owner"];

function moduleFor(type: EntityType): BehaviorCell["module"] {
  switch (type) {
    case "document":
      return "document_task";
    case "chat":
      return "chat_access";
    case "channel":
      return "channel_membership";
    case "project":
      return "project_access";
    case "email_thread":
      return "thread_access";
    case "team":
      return "team_access";
    case "call":
      return "call_access";
    case "foreign_entity":
      return "foreign_entity_access";
    case "crm_company":
      return "crm_company_access";
    case "crm_contact":
      return "crm_contact_access";
    case "user":
      return "user";
    case "calendar_event":
      return "calendar_event";
    case "static_file":
      return "static_file";
    case "reminder":
      return "reminder";
    case "skill":
      return "skill";
    case "channel_message":
      return "channel_membership";
  }
}

/** Independent harvest oracle — not PolicyEngine. User/team ignore shares; everyone else comment-share is View/Comment only. */
function commentShareExpect(type: EntityType, need: AccessLevel): "allow" | "deny" {
  if (type === "user" || type === "team") return "deny";
  if (need === "edit" || need === "owner") return "deny";
  return "allow";
}

function cartesian(): BehaviorCell[] {
  const cells: BehaviorCell[] = [];
  for (const type of ENTITY_TYPES) {
    const facet = type === "document" ? "task" : undefined;
    const module = moduleFor(type);
    for (const need of LEVELS) {
      cells.push({
        module,
        name: `${type} owner×${need}`,
        entityType: type,
        facet,
        actor: "owner",
        need,
        setup: "owner-only",
        expect: "allow",
      });
      cells.push({
        module,
        name: `${type} comment-share×${need}`,
        entityType: type,
        facet,
        actor: "teammate",
        need,
        setup: "comment-share",
        expect: commentShareExpect(type, need),
      });
      cells.push({
        module,
        name: `${type} outsider×${need}`,
        entityType: type,
        facet,
        actor: "outsider",
        need,
        setup: "owner-only",
        expect: "deny",
      });
    }
  }
  return cells;
}

const SPECIALS: BehaviorCell[] = [
  { module: "document_access", name: "edit-share satisfies view", entityType: "document", facet: "task", actor: "teammate", need: "view", setup: "edit-share", expect: "allow" },
  { module: "document_access", name: "assignee gains edit", entityType: "document", facet: "task", actor: "teammate", need: "edit", setup: "assignee", expect: "allow" },
  { module: "document_access", name: "assignee is not owner", entityType: "document", facet: "task", actor: "teammate", need: "owner", setup: "assignee", expect: "deny" },
  { module: "document_access", name: "membership without share is not document view", entityType: "document", facet: "task", actor: "teammate", need: "view", setup: "membership-without-share", expect: "deny" },
  { module: "team_access", name: "admin has edit", entityType: "team", actor: "teammate", need: "edit", setup: "team-admin", expect: "allow" },
  { module: "team_access", name: "admin is not owner", entityType: "team", actor: "teammate", need: "owner", setup: "team-admin", expect: "deny" },
  { module: "team_access", name: "member has view", entityType: "team", actor: "teammate", need: "view", setup: "team-member", expect: "allow" },
  { module: "team_access", name: "member cannot edit", entityType: "team", actor: "teammate", need: "edit", setup: "team-member", expect: "deny" },
  { module: "channel_membership", name: "member comments", entityType: "channel", actor: "teammate", need: "comment", setup: "channel-member", expect: "allow" },
  { module: "channel_membership", name: "member cannot own", entityType: "channel", actor: "teammate", need: "owner", setup: "channel-member", expect: "deny" },
  { module: "channel_role", name: "admin edits", entityType: "channel", actor: "teammate", need: "edit", setup: "channel-admin", expect: "allow" },
  { module: "channel_role", name: "admin is not owner", entityType: "channel", actor: "teammate", need: "owner", setup: "channel-admin", expect: "deny" },
  { module: "channel_membership", name: "bot token comments", entityType: "channel", actor: "bot", need: "comment", setup: "bot-token", expect: "allow" },
  { module: "channel_users", name: "member lists users", entityType: "channel", actor: "teammate", need: "view", setup: "channel-member", expect: "allow", kind: "list" },
  { module: "channel_users", name: "outsider cannot list users", entityType: "channel", actor: "outsider", need: "view", setup: "channel-member", expect: "deny", kind: "list" },
  { module: "chat_access", name: "participant edits chat", entityType: "chat", actor: "teammate", need: "edit", setup: "chat-participant", expect: "allow" },
  { module: "chat_access", name: "participant is not owner", entityType: "chat", actor: "teammate", need: "owner", setup: "chat-participant", expect: "deny" },
  { module: "foreign_entity_access", name: "membership without share is not foreign view", entityType: "foreign_entity", actor: "teammate", need: "view", setup: "membership-without-share", expect: "deny" },
  { module: "project_access", name: "child inherits parent comment", entityType: "project", actor: "teammate", need: "comment", setup: "project-inherit", expect: "allow" },
  { module: "project_access", name: "child inherit cannot own", entityType: "project", actor: "teammate", need: "owner", setup: "project-inherit", expect: "deny" },
  { module: "thread_access", name: "inbox delegate edits", entityType: "email_thread", actor: "teammate", need: "edit", setup: "inbox-delegate", expect: "allow" },
  { module: "thread_access", name: "email_link edits", entityType: "email_thread", actor: "teammate", need: "edit", setup: "email-link", expect: "allow" },
  { module: "thread_access", name: "delegate is not owner", entityType: "email_thread", actor: "teammate", need: "owner", setup: "inbox-delegate", expect: "deny" },
  { module: "call_access", name: "participant views call", entityType: "call", actor: "teammate", need: "view", setup: "call-participant", expect: "allow" },
  { module: "call_access", name: "participant cannot edit call", entityType: "call", actor: "teammate", need: "edit", setup: "call-participant", expect: "deny" },
  { module: "call_channel", name: "channel member views call", entityType: "call", actor: "teammate", need: "view", setup: "call-in-channel", expect: "allow" },
  { module: "call_channel", name: "channel member cannot edit call", entityType: "call", actor: "teammate", need: "edit", setup: "call-in-channel", expect: "deny" },
  { module: "crm_company_access", name: "team member views company", entityType: "crm_company", actor: "teammate", need: "view", setup: "crm-member", expect: "allow" },
  { module: "crm_company_access", name: "team member cannot edit", entityType: "crm_company", actor: "teammate", need: "edit", setup: "crm-member", expect: "deny" },
  { module: "crm_company_access", name: "team admin edits company", entityType: "crm_company", actor: "teammate", need: "edit", setup: "crm-admin", expect: "allow" },
  { module: "crm_contact_access", name: "team member views contact", entityType: "crm_contact", actor: "teammate", need: "view", setup: "crm-member", expect: "allow" },
  { module: "document_access", name: "on_behalf_of uses subject access", entityType: "document", facet: "task", actor: "outsider", need: "comment", setup: "on-behalf-of-comment", expect: "allow" },
];

/**
 * Harvested entity_access behavior matrix.
 * Cartesian = 16 types × 3 actors × 4 levels (05-MAP row 2). Specials = query-module extras.
 * Source crate is not in this repo; expect values are the harvest oracle, not PolicyEngine.
 */
export const BEHAVIOR_MATRIX: BehaviorCell[] = [...cartesian(), ...SPECIALS];
