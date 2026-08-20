import { fixtureId } from "registry";

/** Branch A demo catalog (N20). Intraplex ICP fixtures used by ui-fixtures. */
export const SEED_TEAM = fixtureId("team", 1);
export const SEED_USER = fixtureId("user", 1);

export const SEED_ENTITIES = [
  { entityType: "document", entityId: fixtureId("document", 1), title: "Playbook: Intraplex ICP" },
  { entityType: "project", entityId: fixtureId("project", 1), title: "Outreach" },
  { entityType: "channel", entityId: fixtureId("channel", 1), title: "Outreach stand-up" },
  { entityType: "email_thread", entityId: fixtureId("email_thread", 1), title: "Intraplex ICP" },
  { entityType: "crm_company", entityId: fixtureId("crm_company", 1), title: "Intraplex" },
  { entityType: "crm_contact", entityId: fixtureId("crm_contact", 1), title: "Ada" },
  { entityType: "calendar_event", entityId: fixtureId("calendar_event", 1), title: "ICP review" },
  { entityType: "call", entityId: fixtureId("call", 1), title: "Stand-up" },
  { entityType: "static_file", entityId: fixtureId("static_file", 1), title: "brief.pdf" },
] as const;

export const SEARCH_COVERAGE_TYPES = [
  "document",
  "project",
  "chat",
  "channel",
  "email_thread",
  "call",
  "crm_company",
] as const;

export const REQUIRED_DOMAIN_PACKAGES = [
  "identity",
  "registry",
  "authz",
  "control-plane",
  "soup",
  "shell",
  "task-slice",
  "documents",
  "task-properties",
  "channels",
  "connectivity",
  "mailbox",
  "crm",
  "calendar",
  "files",
  "converter",
  "search",
  "activity",
  "notifications",
] as const;

export const REQUIRED_STORAGE_OWNERS = [
  "entity_registry",
  "soup_search_index",
  "email_thread",
  "crm_company",
  "file_blob",
  "converter_jobs",
  "activity_facts",
  "notification_log",
] as const;
