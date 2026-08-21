import type { PropertyEntityType } from "registry";

/** Nine property_data_type values (ledger §7 / 04 §6). Semantics kept; storage replaced. */
export const PROPERTY_DATA_TYPES = [
  "text",
  "number",
  "date",
  "select",
  "multi_select",
  "user",
  "boolean",
  "url",
  "relation",
] as const;

export type PropertyDataType = (typeof PROPERTY_DATA_TYPES)[number];

export type PropertyValue =
  | { kind: "text"; text: string }
  | { kind: "number"; number: number }
  | { kind: "date"; date: string }
  | { kind: "select"; optionId: string | null }
  | { kind: "multi_select"; optionIds: string[] }
  | { kind: "user"; userIds: string[] }
  | { kind: "boolean"; flag: boolean }
  | { kind: "url"; url: string }
  | { kind: "relation"; entityIds: string[] };

export interface PropertyDefinition {
  id: string;
  tenantId: string | null;
  name: string;
  dataType: PropertyDataType;
  isSystem: boolean;
  applicable: readonly PropertyEntityType[];
  version: number;
}

export interface PropertyOption {
  id: string;
  definitionId: string;
  key: string;
  label: string;
  rank: number;
}

export interface EntityPropertyRow {
  entityId: string;
  storageType: PropertyEntityType;
  definitionId: string;
  values: PropertyValue;
  version: number;
}

export interface TagRecord {
  id: string;
  tenantId: string;
  name: string;
  mergedIntoId: string | null;
}

export interface BulkTarget {
  receipt: import("authz").Receipt;
}

export interface BulkSetValuesInput {
  targets: readonly BulkTarget[];
  definitionId: string;
  value: PropertyValue;
}

export interface BulkSetOptionsInput {
  targets: readonly BulkTarget[];
  definitionId: string;
  optionIds: readonly string[];
}

export interface BulkItemResult {
  entityId: string;
  ok: boolean;
  error?: string;
  version?: number;
}

export interface BulkResult {
  results: BulkItemResult[];
  succeeded: number;
  failed: number;
}

export interface GridRow {
  entityId: string;
  title: string;
  facet: "task" | "snippet" | "skill" | null;
  values: Record<string, PropertyValue | null>;
}

export interface KanbanColumn {
  optionId: string;
  label: string;
  items: GridRow[];
}

export interface CreateDefinitionInput {
  name: string;
  dataType: PropertyDataType;
  applicable?: readonly PropertyEntityType[];
  options?: readonly { key: string; label: string }[];
}
