# Domain specification — Tasks + properties (N8 / SUP-556)

## Verdict and source evidence

Wave 4a core domain. Direct extension of the N6 slice freeze (SUP-553). OD-7
branch (b): a task is a **document + facet `task` + TASK property bundle**;
TASK is a properties-domain storage discriminator, not an `EntityType`. Pattern
2a: property *semantics* kept; storage replaced (values on the owning entity
record + a materialized filter index). Bulk RPC shapes preserved (a per-item
client loop is not faithful). 05-MAP row 6: bulk-edit grid and kanban
transition remain consistent over the **same Soup projection**. One Task
Database (Q20). Source kanban at the pin is companies, not tasks — this node
ships a Soup-grouped kanban view for the consistency proof, not a claim of
task-kanban product parity. OD-1 Branch A: mapping dry run `wrote=false`. No
kernel patches. No Instantly send/activate.

## User journeys

`c` then `t` still creates a task through N6 (`TaskSlice`). Create seeds the
TASK system-property bundle (status / assignees / priority). An operator
defines a custom EAV property (typed, with options), bulk-edits a grid column
across N selected rows in **one** `bulkSetOptions` / `bulkSetValues` call,
and a kanban card drag is the same property write. Grid cells and kanban
lanes then agree. Tag merge remaps references. Reload rebuilds Soup from the
document outbox and the property index from the properties outbox.

## Invariants

No Task entity type. Handlers take receipts. Query never mints. Projection is
rebuildable. Duplicate idempotency keys are no-ops. System properties are not
deletable. A bulk edit is atomic per entity and reported per-item, not
all-or-nothing across entities. Property rows for a task are keyed `TASK`
(facet resolution lives in this domain). Access receipts for tasks mint as
`document`. Parent Task / Subtasks apply only to `TASK`; Stage / Owner /
Revenue apply only to `COMPANY`.

## Entities and identifiers

- `document` (`doc_`) + facet `task` — the task (N6 authority, One Task Database).
- `property_definition` — team-scoped schema (system + custom). Not a registry type.
- `property_option` — select / multi-select option.
- `entity_properties` — EAV values (`entity_id`, `storageType`, `definitionId`, `values`).
- `tag` — definition flavor; merge remaps option references.

`property_entity_type` (10) and `property_data_type` (9) are frozen. TASK maps
to `{ kind: "facet", type: "document", facet: "task" }`.

## Authority and consistency

`TaskSlice` remains the document+task single-writer (N6 freeze).
`TaskProperties` wraps it: schema mutations serialize on the team-scoped
property schema; value writes fan out per entity through the owning document
and emit per-entity `properties` events. Kanban drag and a concurrent grid
edit on the same entity serialize there.

## Storage and indexes

In-process EAV maps (stand-in for entity records) + N3 outbox topic
`properties` + N4 Soup (row set) + `PropertyValueIndex` (kanban/grid grouping).
N3 `STORAGE_OWNERS` rows: `property_schema`, `entity_property_index`. Old EAV
table shapes are a design reference only.

## RPC/API contract

Typed `PropertiesApi` capability (ADR-002). Not added to kernel `api.ts`.
Four endpoint groups: definitions, tags (create / merge / promote), per-entity
values, entity_properties. First-class bulk methods: `bulkSetValues`,
`bulkSetOptions`. No Instantly send/activate methods.

## Commands and UI surfaces

Command rows counted under N2's 26 (`block-entity` 17 + `entity` 8 +
`property-editor` 1). UI ships here: `TaskGrid`, `KanbanBoard`,
`PropertyEditor`, `TaskPropertiesWorkspace` on Shell path `/tasks`. Parity
set: `block-entity.{properties,tags,priority,assignee,status}`,
`property-editor.close`, bulk-move rows, Soup property rows. Kanban is
pointer-driven (parity via UI tests, not hotkeys). Source had no task kanban
— company kanban remains N12.

## Authorization matrix

Value writes: Edit receipt on the target document (minted per entity in bulk;
per-item envelope carries authz failures). Schema / tag mutations:
tenant-scoped actor (Team DO stand-in). Assignees gain edit via
`AccessState.assigneeIds` (harvested OD-7). Share + revoke hides Soup rows
(SEC-1). Cross-tenant mint denies.

## Events, jobs, retries, and replay

Topic `properties`. Per-entity events (not one mega-event); event id =
`(entity, property, version)`. Activity action `property_changed`. Retries /
poison / replay per ADR-005. Soup list rows still publish on `documents` via
N6 when status / priority / assignee change.

## External providers

None. Instantly is out of scope. GitHub PR ↔ task linking stays N10 / later.

## Migration and reconciliation

OD-1 Branch A: fixture mapping dry run from legacy `property_definition` /
`property_option` / `entity_properties` / `tags`. No Postgres load. Values
fold into the owning entity during that entity's own migration pass.

## Tests and parity fixtures

`packages/task-properties/src/slice.test.tsx` — mapping dry run `wrote=false`,
One Task Database, 18 system keys, custom EAV, bulk per-item envelope, 05-MAP
row 6 kanban/grid Soup consistency, 9 data-type round-trips, applicability
guards, tag merge, assignee edit grant, index rebuild, idempotency, SEC-1,
N2 26-command freeze + N8 parity, SSR grid+kanban on `/tasks`, STORAGE_OWNERS.

## Observability/SLOs

Bulk-op p95 by batch size; index lag (kanban drag → lane query); per-consumer
poison counters. Physical D1 lag SLO is 4a.

## Failure modes and rollback

`AuthzError` / missing receipt / applicability miss. Projection rollback =
drop + `rebuildProjection()` (Soup from N6 outbox, index from properties
outbox). Wrapper rollback = previous package; kernel untouched. N6 slice
package stays frozen.

## Open decisions

- **OD-5 residue** — properties row ruled keep; concrete D1 index DDL is 4a.
- Company kanban product surface is N12 (CRM); this node only proves grid /
  kanban consistency over Soup.
- Full 18-key option palettes for Stage / company fields wait on N12 seed.
- Bidirectional Parent Task / Subtasks linking and task numbering (`team_task`)
  are later task-behavior, not this node's EAV cut.
