import type { PropertyEntityType } from "registry";
import type { PropertyDataType, PropertyDefinition, PropertyOption } from "./types.js";

/** Ledger: 18 system keys. Status / assignees / priority are the N6 cut; the rest land here. */
export const SYSTEM_DEFINITION_IDS = {
  assignees: "pdef_assignees",
  status: "pdef_status",
  priority: "pdef_priority",
  dueDate: "pdef_due_date",
  parentTask: "pdef_parent_task",
  subtasks: "pdef_subtasks",
  dependsOn: "pdef_depends_on",
  effort: "pdef_effort",
  storyPoints: "pdef_story_points",
  relevantDocuments: "pdef_relevant_documents",
  source: "pdef_source",
  companies: "pdef_companies",
  sender: "pdef_sender",
  recipients: "pdef_recipients",
  subject: "pdef_subject",
  stage: "pdef_stage",
  owner: "pdef_owner",
  revenue: "pdef_revenue",
} as const;

export const TAGS_DEFINITION_ID = "pdef_tags";

export const STATUS_OPTION_IDS = {
  todo: "opt_status_todo",
  inProgress: "opt_status_in_progress",
  inReview: "opt_status_in_review",
  completed: "opt_status_completed",
  canceled: "opt_status_canceled",
} as const;

export const PRIORITY_OPTION_IDS = {
  low: "opt_priority_low",
  medium: "opt_priority_medium",
  high: "opt_priority_high",
  urgent: "opt_priority_urgent",
  critical: "opt_priority_critical",
} as const;

export const KANBAN_NONE = "none";

const ANY: PropertyEntityType[] = [];
const TASK_ONLY: PropertyEntityType[] = ["TASK"];
const COMPANY_ONLY: PropertyEntityType[] = ["COMPANY"];

interface SeedDef {
  id: string;
  name: string;
  dataType: PropertyDataType;
  applicable: readonly PropertyEntityType[];
  options?: readonly { id: string; key: string; label: string }[];
}

const SEED: readonly SeedDef[] = [
  { id: SYSTEM_DEFINITION_IDS.assignees, name: "Assignees", dataType: "user", applicable: ANY },
  {
    id: SYSTEM_DEFINITION_IDS.status,
    name: "Status",
    dataType: "select",
    applicable: ANY,
    options: [
      { id: STATUS_OPTION_IDS.todo, key: "todo", label: "Not Started" },
      { id: STATUS_OPTION_IDS.inProgress, key: "in_progress", label: "In Progress" },
      { id: STATUS_OPTION_IDS.inReview, key: "in_review", label: "In Review" },
      { id: STATUS_OPTION_IDS.completed, key: "completed", label: "Completed" },
      { id: STATUS_OPTION_IDS.canceled, key: "canceled", label: "Canceled" },
    ],
  },
  {
    id: SYSTEM_DEFINITION_IDS.priority,
    name: "Priority",
    dataType: "select",
    applicable: ANY,
    options: [
      { id: PRIORITY_OPTION_IDS.low, key: "low", label: "Low" },
      { id: PRIORITY_OPTION_IDS.medium, key: "medium", label: "Medium" },
      { id: PRIORITY_OPTION_IDS.high, key: "high", label: "High" },
      { id: PRIORITY_OPTION_IDS.urgent, key: "urgent", label: "Urgent" },
      { id: PRIORITY_OPTION_IDS.critical, key: "critical", label: "Critical" },
    ],
  },
  { id: SYSTEM_DEFINITION_IDS.dueDate, name: "Due Date", dataType: "date", applicable: ANY },
  { id: SYSTEM_DEFINITION_IDS.parentTask, name: "Parent Task", dataType: "relation", applicable: TASK_ONLY },
  { id: SYSTEM_DEFINITION_IDS.subtasks, name: "Subtasks", dataType: "relation", applicable: TASK_ONLY },
  { id: SYSTEM_DEFINITION_IDS.dependsOn, name: "Depends On", dataType: "relation", applicable: ANY },
  { id: SYSTEM_DEFINITION_IDS.effort, name: "Effort", dataType: "number", applicable: ANY },
  { id: SYSTEM_DEFINITION_IDS.storyPoints, name: "Story Points", dataType: "number", applicable: ANY },
  { id: SYSTEM_DEFINITION_IDS.relevantDocuments, name: "Relevant Documents", dataType: "relation", applicable: ANY },
  { id: SYSTEM_DEFINITION_IDS.source, name: "Source", dataType: "text", applicable: ANY },
  { id: SYSTEM_DEFINITION_IDS.companies, name: "Companies", dataType: "relation", applicable: ANY },
  { id: SYSTEM_DEFINITION_IDS.sender, name: "Sender", dataType: "user", applicable: ANY },
  { id: SYSTEM_DEFINITION_IDS.recipients, name: "Recipients", dataType: "user", applicable: ANY },
  { id: SYSTEM_DEFINITION_IDS.subject, name: "Subject", dataType: "text", applicable: ANY },
  { id: SYSTEM_DEFINITION_IDS.stage, name: "Stage", dataType: "select", applicable: COMPANY_ONLY },
  { id: SYSTEM_DEFINITION_IDS.owner, name: "Owner", dataType: "user", applicable: COMPANY_ONLY },
  { id: SYSTEM_DEFINITION_IDS.revenue, name: "Revenue", dataType: "number", applicable: COMPANY_ONLY },
];

export const SYSTEM_KEY_COUNT = SEED.length;

export function seedSystemDefinitions(): {
  definitions: PropertyDefinition[];
  options: PropertyOption[];
} {
  const definitions: PropertyDefinition[] = SEED.map((row) => ({
    id: row.id,
    tenantId: null,
    name: row.name,
    dataType: row.dataType,
    isSystem: true,
    applicable: row.applicable,
    version: 1,
  }));
  const options: PropertyOption[] = [];
  for (const row of SEED) {
    (row.options ?? []).forEach((option, rank) => {
      options.push({
        id: option.id,
        definitionId: row.id,
        key: option.key,
        label: option.label,
        rank,
      });
    });
  }
  definitions.push({
    id: TAGS_DEFINITION_ID,
    tenantId: null,
    name: "Tags",
    dataType: "multi_select",
    isSystem: true,
    applicable: ANY,
    version: 1,
  });
  return { definitions, options };
}

const STATUS_KEY_TO_ID: Record<string, string> = {
  todo: STATUS_OPTION_IDS.todo,
  in_progress: STATUS_OPTION_IDS.inProgress,
  in_review: STATUS_OPTION_IDS.inReview,
  completed: STATUS_OPTION_IDS.completed,
  canceled: STATUS_OPTION_IDS.canceled,
};

const PRIORITY_KEY_TO_ID: Record<string, string> = {
  low: PRIORITY_OPTION_IDS.low,
  medium: PRIORITY_OPTION_IDS.medium,
  high: PRIORITY_OPTION_IDS.high,
  urgent: PRIORITY_OPTION_IDS.urgent,
  critical: PRIORITY_OPTION_IDS.critical,
};

const OPTION_ID_TO_KEY: Record<string, string> = {
  [STATUS_OPTION_IDS.todo]: "todo",
  [STATUS_OPTION_IDS.inProgress]: "in_progress",
  [STATUS_OPTION_IDS.inReview]: "in_review",
  [STATUS_OPTION_IDS.completed]: "completed",
  [STATUS_OPTION_IDS.canceled]: "canceled",
  [PRIORITY_OPTION_IDS.low]: "low",
  [PRIORITY_OPTION_IDS.medium]: "medium",
  [PRIORITY_OPTION_IDS.high]: "high",
  [PRIORITY_OPTION_IDS.urgent]: "urgent",
  [PRIORITY_OPTION_IDS.critical]: "critical",
};

export function statusOptionIdForKey(key: string | null | undefined): string | null {
  if (!key) return null;
  return STATUS_KEY_TO_ID[key] ?? null;
}

export function priorityOptionIdForKey(key: string | null | undefined): string | null {
  if (!key) return null;
  return PRIORITY_KEY_TO_ID[key] ?? null;
}

export function optionKeyFromId(optionId: string | null | undefined): string | null {
  if (!optionId || optionId === "none") return null;
  return OPTION_ID_TO_KEY[optionId] ?? optionId;
}
