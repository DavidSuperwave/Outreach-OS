# OD-7 audit — how Macro/Neuwave actually treated "task" (and "thread")

- **Audited repo:** `/Users/david/Projects/Neuwave` @ `9f7a26bccb85e6f806a6e0c8d6c8e53f3a3541bf` (read-only; pin verified via `git log -1`)
- **Date:** 2026-08-20
- **Purpose:** evidence for the OD-7 ruling (entity-type canonicalization: task/thread). This note presents evidence and a characterization; it does **not** make the ruling.
- **Convention:** everything in §1–§6 is a pinned fact (path:line in the audited repo). §7 is inference and is labeled as such. The one inline judgment call in §5 (the two-threads ambiguity) is flagged where it appears.

---

## 1. What IS a task in the data model

**A task is a Document row plus a one-row subtype marker. There is no task table, no task aggregate, and no `Task` variant in the core entity enum.**

- Core entity enum: `EntityType` has 16 variants — User, Chat, Channel, ChannelMessage, Document, Project, EmailThread, CalendarEvent, Team, Call, ForeignEntity, StaticFile, CrmCompany, CrmContact, Reminder, Skill — and **no Task, no Thread** (`crates/model-entity/src/lib.rs:34-68`).
- Subtype marker: `document_sub_type` table, PK = `document_id` FK→`"Document"(id)` ON DELETE CASCADE, one enum column `sub_type document_sub_type_value` originally `ENUM ('task')` (`crates/macro_db_client/migrations/20251205213515_create_document_sub_type.sql:1-13`). The Rust enum later grew to `Task | Snippet | Skill` (`crates/document_sub_type/src/lib.rs:23-32`) — task sits in the same mechanism as snippets and skills.
- Creation: the document-create endpoint takes `is_task: bool` and maps it to `sub_type: DocumentSubType::Task` on ordinary `CreateDocumentRepoArgs` (`crates/documents/src/inbound/axum_router/create_document.rs:101-104`); the repo inserts the marker row inside the same transaction as the Document row (`crates/documents/src/outbound/pg_document_repo/create.rs:53-75`, called from `crates/documents/src/outbound/pg_document_repo.rs:455`).
- Per-team short ids: tasks get a Linear-style team-scoped number via `team_task_counter` + `team_task (team_id, document_id, task_num)`, both FK'd to `team`/`"Document"` (`crates/macro_db_client/migrations/20260520130000_create_team_task.sql:1-19`; allocation in `crates/documents/src/outbound/pg_document_repo/create.rs:79-105`). The backfill in that migration identifies existing tasks by `JOIN document_sub_type ... WHERE dst.sub_type = 'task'` (lines 22-46) — i.e. even the "task number" feature discovers tasks through the document subtype.
- Task fields (status/assignees/due/priority/…) are **not columns anywhere**. They are rows in the generic `entity_properties` table (`entity_id TEXT, entity_type property_entity_type, property_definition_id, values JSONB`) (`crates/macro_db_client/migrations/20251030100000_init_properties_schema.sql:117-163`), keyed under `entity_type = 'TASK'`.

**Answer:** a task is a document subtype + a property bundle, not its own aggregate. The only task-dedicated storage is the numbering pair (`team_task*`), the dedup tables (§4), and the `github_pr_tasks` link table (§4) — all of which reference `"Document"(id)`.

### Where TASK/THREAD in `property_entity_type` came from

- The enum was created with 6 values `('CHANNEL','CHAT','DOCUMENT','PROJECT','THREAD','USER')` — **THREAD is day-one**, before tasks existed (`crates/macro_db_client/migrations/20251030100000_init_properties_schema.sql:20-27`).
- `'TASK'` (and `'COMPANY'`) were added by the system-properties migration (`crates/macro_db_client/migrations/20251128000000_add_system_properties.sql:3-4`), the same migration that introduced `is_system` property definitions.
- Later additions: `'CALL_RECORD'` (`20260709192942_add_call_record_property_entity_type.sql:2`), calendar-event (`20260726023229_calendar_event_property_entity_type.sql:3`).
- The Rust mirror of the DB enum is `models_properties::shared::EntityType` (10 variants incl. Task and Thread), `#[sqlx(type_name = "property_entity_type")]` (`crates/models_properties/src/shared/entity_type.rs:9-26`), with `From<DocumentSubType>`: `Task → EntityType::Task`, `Snippet|Skill → EntityType::Document` (lines 68-76).

### The API boundary explicitly refuses to make Task an entity type

`crates/models_properties/src/api/property_target.rs:6-30` — the canonical property-target enum (`PropertyTargetEntityType`) has `Document` (doc comment: "Document, including tasks and snippets") and `Thread`, and its type-level doc states verbatim:

> "Tasks are documents at API boundaries. `Task` intentionally does not exist here; task classification is resolved by the properties domain from the document subtype."

The resolution happens server-side in `resolve_subjects`: an incoming `Document` target is looked up in `document_sub_type` and stored as `EntityType::Task` iff the subtype is Task, else `EntityType::Document`; `EmailThread → EntityType::Thread` (`crates/properties/src/domain/service_impl/mod.rs:220-281`, esp. 247-258). The reverse map collapses again: `EntityType::Document | EntityType::Task → AccessEntityType::Document` (`crates/properties/src/domain/model.rs:16-28`).

So `TASK` in the DB enum is an **internal storage discriminator private to the properties domain** — it exists so a task's property rows are keyed distinctly from plain-document property rows, while every external contract says "document".

### The task property set (what reads/writes `TASK` rows)

- Seeded system definitions (`crates/macro_db_client/migrations/20251128000001_seed_system_properties.sql`): Assignees (multi user, :3-23), Status (:25-45, options Not Started/In Progress/In Review/Completed/Canceled :333-369), Priority (:47-67, Low→Critical :371-401), Due Date (:69-89), Parent Task (`specific_entity_type='TASK'`, :91-111), Subtasks (:113-133), Depends On (:135-155), Effort (:157-177), Story Points (:179-199), Relevant Documents (:201-221), Source (:223-243) — plus Companies/Sender/Recipients/Subject for other types.
- Applicability guard: Parent Task and Subtasks may only attach when `entity_type == EntityType::Task`; Stage/Owner/Revenue only for Company; everything else attaches to any type (`crates/properties/src/domain/service_impl/helpers.rs:48-65`). Note: there are **no thread-only properties**.
- Writers/readers: the properties service (`crates/properties`) is the sole owner; e.g. assignee reads via `get_entity_property_value(task_id, EntityType::Task, ASSIGNEES_UUID)` (`crates/properties/src/domain/service_impl/task_properties.rs:204-213`).

## 2. How tasks enter lists / Soup / grouping / kanban

**Soup has no Task item type. Tasks ride the Document item with subtype data joined on, and the surface re-derives "task-ness" per item.**

- `SoupItem` variants: Document, Project, EmailThread, Chat, Channel, ChannelThread, Call, CalendarEvent, CrmCompany, ForeignEntity, Reminder — no Task (`crates/models_soup/src/item.rs:27-45`). `SoupItem::entity()` for a task returns `EntityType::Document` (model-entity type) (`crates/models_soup/src/item.rs:56-57`).
- `SoupDocument.sub_type: Option<SoupDocumentSubType>` where `Task { is_completed: bool }` carries the one denormalized task flag ("True if the Status property is set to 'Completed'") (`crates/models_soup/src/document.rs:13-24`). `SoupDocument::entity_type()` (properties-domain type) returns `EntityType::Task` iff subtype is Task, with the doc comment "Snippets and skills are documents as far as the entity system is concerned" (`crates/models_soup/src/document.rs:115-129`).
- The soup SQL LEFT JOINs `document_sub_type` and computes `is_completed` with `CASE WHEN dt.sub_type = 'task' ...` against the Status property (`crates/soup/src/outbound/pg_soup_repo/expanded/by_cursor.rs:147-164, 315-335`; same in `expanded/by_ids.rs:75-89`).
- Property lookups for rendered items go through `SoupItem::to_entity_reference()`, which uses `doc.entity_type()` — so a task item's properties are fetched under `TASK`, an email thread's under `Thread` (`crates/models_soup/src/item.rs:193-205`).
- Filtering: the Soup filter AST has a document node `dst` = "filters by document sub type" (`crates/item_filters/src/ast/document.rs:50-52`), plus a task-composite `cbm` node ("tasks that are created by me, assigned to me, and not completed", :47-49). The AI list tool documents the contract outright: "Macro tasks are document items with df subtype {\"l\":{\"dst\":\"task\"}} and includeTypes [\"document\"] … Filter task Status and Assignees through propf using entity_type TASK" (`crates/soup/src/inbound/toolset/list_entities.rs:382, 387, 401`).
- Grouping (list group-by, incl. by Status/Assignee): property-based grouping joins `entity_properties` on `ep.entity_type = t.property_entity_type` — "Property rows are also matched to the Soup item's canonical property entity type, so a task ignores legacy `DOCUMENT` assignments for the same id" (`crates/soup/src/outbound/pg_soup_repo/grouping.rs:56-99`, esp. 63-64, 88).
- Kanban: the only kanban at the pin is **companies**, not tasks (`apps/web/src/features/next-soup/soup-view/views/companies/CompanyKanban.tsx`; no task kanban component found). The tasks surface is a grouped list (`apps/web/src/features/next-soup/soup-view/views/tasks/TaskListEntity.tsx`, `TaskListHeader.tsx`).

## 3. Access control

**Tasks have zero presence in access control. Every access decision about a task is a decision about a Document.**

- `entity_access` re-exports the core enum: `pub use model_entity::EntityType` (`crates/entity_access/src/domain/models.rs:13`) — no Task/Thread variant exists to extract.
- `EntityType::is_valid_entity_access_entity()` enumerates all 16 variants; `Document => true` covers tasks implicitly, and no task case exists (`crates/model-entity/src/lib.rs:73-102`).
- When the properties domain must check access to a *referenced* task (Parent Task/Subtasks linking), it mints the receipt as `EntityType::Document` (`crates/properties/src/domain/service_impl/task_properties.rs:48-56`).
- When assigning a task grants the assignee edit access, it writes `entity_access` with `model_entity::EntityType::Document` (`crates/properties/src/outbound/permission_service.rs:207-225`, esp. 222).
- The properties permission adapter's storage-type map likewise sends `AccessEntityType::Document → StorageEntityType::Document` — Task never appears on the access side (`crates/properties/src/outbound/permission_service.rs:97-110`).

## 4. Task-specific behavior (the "task is special" surface)

Task-ness is real, but it is implemented as *behavior keyed off the subtype/property bundle*, not off an entity type:

- **Assignee side-effects:** setting Assignees triggers (a) edit-permission grant to assignees (as Document, §3) and (b) task-assigned notifications diffed against current assignees (`crates/properties/src/domain/service_impl/mod.rs:633-638` → `crates/properties/src/domain/service_impl/task_properties.rs:145-249`; `TaskAssignedNotification` model at `crates/properties/src/domain/model.rs:298`).
- **Bidirectional Parent Task / Subtasks linking**, transactional, task-entity-type-guarded (`crates/properties/src/domain/service_impl/mod.rs:610-631`; `task_properties.rs:62+`; validation "Parent Task must reference a Task entity" `task_properties.rs:75-81`).
- **Per-team task numbers + slug route:** `team_task` tables (§1); frontend `/task-slug/:taskSlug` resolves a team slug (GitHub-autolink friendly) and redirects to the canonical `/task/{documentId}` (`apps/web/src/routes/TaskRoute.tsx:15-67`; registered at `apps/web/src/routes/Root.tsx:224-227`).
- **GitHub PR ↔ task linking:** `github_pr_tasks (github_key, task_id)` where task_id is "the short id of the macro task" (`crates/macro_db_client/migrations/20260305182148_track_task_with_pr.sql:1-20`; `crates/github/src/domain/service/sync/mod.rs`; frontend `apps/web/src/features/block-md/component/InlineTaskGithubPullRequests.tsx`, `TaskCopyBranchButton.tsx`).
- **Duplicate detection:** `task_duplicate_embedding` (pgvector) + `task_duplicate_match`, both FK→`"Document"(id)` (`crates/macro_db_client/migrations/20260528120000_task_duplicate_detection.sql:1-30`; crate `crates/task_dedup`; frontend `TaskDuplicateMatches.tsx`).
- **Hotkeys/commands (selection-scoped, gated on `isTaskEntity`):** set priority `shift+cmd+p`, assignee `shift+cmd+a`, status `shift+cmd+s`, property editor `shift+cmd+o` — each condition requires `entities.every(isTaskEntity)` (`apps/web/src/features/next-soup/actions/use-entity-action-hotkeys.ts:557-667`). Global "Create task" launcher command with its own hotkey token (`apps/web/src/features/command/Launcher.tsx:484-491`).
- **Bulk edits** run through the generic properties bulk endpoints, which apply the same per-type applicability guard per update (`crates/properties/src/domain/service_impl/mod.rs:805, 907`; toolset `crates/properties/src/inbound/toolset/bulk_set_entity_property_options.rs`).
- **Metadata properties:** tasks reuse the *document* metadata builder verbatim — "Build the metadata properties for a document (or task, which is stored as a document)" (`crates/properties/src/domain/metadata.rs:45-101`).
- **Search:** no task doc-type; document search filters by `sub_type` (`crates/search_service/src/api/search/document.rs:52, 186`; `crates/search_service/src/api/search/simple/filter.rs:50`).

## 5. THREAD, briefly (same four questions)

⚠️ Disambiguation (flagged judgment call): the codebase has two thread concepts — **email threads** (`EmailThread`) and **channel threads** (`SoupItem::ChannelThread`). `'THREAD'` in `property_entity_type` is unambiguously the **email thread**: `AccessEntityType::EmailThread ↔ EntityType::Thread` in every map (`crates/properties/src/domain/service_impl/mod.rs:258`, `crates/properties/src/domain/model.rs:23`, `crates/properties/src/outbound/permission_service.rs:104`, `crates/models_soup/src/item.rs:202-205`). Channel threads have no properties at all (`to_entity_reference → None`, `crates/models_soup/src/item.rs:211`). The OD-7 registry line "thread … no property or Soup-tab surface at the pin" (06:175-177) is accurate only for *channel* threads; for *email* threads it is contradicted by the evidence below.

1. **Data model:** the email thread is a genuine first-class entity — `EntityType::EmailThread` is one of the 16 core variants (`crates/model-entity/src/lib.rs:47-48`), with its own `email_threads` table (see the ownership query joining `email_threads`/`email_links`, `crates/entity_access/src/outbound/pg_access_repo/queries/thread_access.rs:27-49`). `'THREAD'` in `property_entity_type` is **not a new entity**: it is the properties-domain storage alias for EmailThread, present since the schema's first migration (`20251030100000:25`).
2. **Lists/Soup:** `SoupItem::EmailThread` is its own item variant (`crates/models_soup/src/item.rs:35`), surfaces on the `/mail` tab (`apps/web/src/routes/Root.tsx:250-253`), and is property-capable/taggable (`item.rs:202-205`; `apps/web/src/lib/constants/list-views.ts:59-71` — "TAGGABLE_ENTITY_TYPES (document/task/thread/project/chat/call)").
3. **Access:** `EmailThread => true` in `is_valid_entity_access_entity` (`crates/model-entity/src/lib.rs:81`); dedicated access query module `thread_access.rs` (owner-or-inbox-delegate via `email_links`, plus `EmailThreadPermission`/`UserItemAccess`); the properties adapter carries an ownership fallback specific to threads (`crates/properties/src/outbound/permission_service.rs:62-83`).
4. **Thread-specific property behavior:** none seeded and none guarded — there are no thread-only property definitions (helpers.rs:48-65 names task-only and company-only sets only). Threads get **computed, read-only metadata properties** (Subject, Thread Started, Last Received, Last Sent, Messages) synthesized from `email_threads`/`email_messages` at read time, not stored (`crates/properties/src/domain/metadata.rs:33-38, 103-146`; `crates/models_properties/src/service/thread_metadata.rs`). Stored THREAD rows in `entity_properties` come from generic cross-type properties (tags etc.).

**Net for thread:** THREAD in the properties enum is a *naming/storage alias for the already-first-class EmailThread*, not evidence of a missing entity type. Nothing needs "promoting"; the skew is nomenclature (`EmailThread` vs `THREAD`), same class of skew as `Call` vs `CALL_RECORD` and `CrmCompany` vs `COMPANY`.

## 6. Frontend model

- **Type:** `TaskEntity = EntityBase & { type: 'document'; fileType: 'md'; subType: { type: 'task'; is_completed?: boolean } }` — a task is *typed as a document* with a subtype discriminant, exactly like snippet/skill (`apps/web/src/features/entity/types/entity.ts:153-198`; guard `isTaskEntity` :390-394). A widened presentation-only union exists: `ExpandedEntityType = EntityType | 'task' | 'snippet' | 'skill'` (:526).
- **Conversion:** `entityTypeToItemType('TASK') → 'document'` (`apps/web/src/features/property/utils/entityConversion.ts:52-54`).
- **Routes:** `/tasks` list tab is just another layout route alongside `/documents`, `/mail`, etc. (`apps/web/src/routes/Root.tsx:258-261`); `/task-slug/:slug` → redirect to canonical task URL (§4). No standalone task-detail component exists: the detail view is the markdown document block (`block-md`) which conditionally augments itself when `blockAliasedName === 'task'` (`apps/web/src/features/block-md/component/TopBar.tsx:64`) with `InlineTaskProperties.tsx`, `InlineTaskGithubPullRequests.tsx`, `TaskDuplicateMatches.tsx`, `ComposeTask.tsx` (all under `apps/web/src/features/block-md/component/`) — i.e. **a task's detail view is a document editor wearing task chrome**.
- **List surface:** tasks view under next-soup (`apps/web/src/features/next-soup/soup-view/views/tasks/`), with filter configs built from `isTask = { include: { subType: ['task'] } }` (`apps/web/src/features/next-soup/filters/configs/base.ts:40-41`) and status/priority filters over the system property ids (`apps/web/src/features/next-soup/filters/configs/task.ts:30-60`). Other tabs *exclude* the subtype (`configs/entity-type.ts:20, 71`) — the documents tab is "documents minus tasks", confirming tasks and documents are one pool partitioned by facet.

---

## 7. Conclusion (inference — clearly separated from the facts above)

**Macro's de-facto answer:** *"A task is a markdown document (Document row + `document_sub_type='task'`), deliberately kept a document at every identity, access-control, and API boundary, and promoted to a distinct subject only inside the properties/list domain (storage key `TASK`, system property bundle, subtype-gated behaviors)."* The promotion is real but strictly scoped: one enum value in one internal DB, resolved from the document subtype on every call, and collapsed back to Document the moment access control or the public API is involved (`property_target.rs:8-10` states this as design intent, not accident). Thread requires no answer at all: `THREAD` is the properties-domain spelling of the already-first-class `EmailThread`.

**Mapping to the OD-7 options:**

- **(a) both first-class** — contradicted on both halves. Task is nowhere first-class in Macro's core model (§1, §3, §6); thread needs no new type because EmailThread already is one (§5).
- **(b) both facets + property-facet dimension** — this is the closest match to Macro's *core architecture*. Task is literally a facet (document subtype), and the properties domain's `storage_entity_type` resolution (`service_impl/mod.rs:247-258`) **is** the "facet dimension" option (b) describes, already built and shipped. Caveat: "thread stays a facet" is a mislabel — email thread was never a facet; it is a first-class entity whose properties key is merely named THREAD.
- **(c) hybrid: task first-class, thread facet** — matches Macro's *presentation/product* behavior (own tab, own property set, own numbering+slug+PR links, task-only hotkeys, distinct grouping identity) but **not** its data/access architecture, and its stated rationale needs two corrections: (i) "task participates in lists/kanban as a peer" — there is no task kanban at the pin (§2), and in lists task is a *filtered partition of the document pool*, not a peer item type (`SoupItem` has no Task variant); (ii) "thread's access model is derivative of its parent … no property or Soup-tab surface" — true only of channel threads; email threads (the THREAD of the enum) have their own access module, their own Soup item, a mail tab, and property surfaces (§5).

**Support/contradiction of the standing hybrid recommendation:** the evidence **partially contradicts** it. On the thread half, (c)'s conclusion (don't add a THREAD entity type) is supported, but for a different reason than stated: THREAD is an alias of first-class EmailThread, not a derivative facet. On the task half, Macro's own treatment argues that first-classing task is *not* required to deliver everything Macro shipped — Macro delivered the full task feature set (system properties, assignment side-effects, numbering, dedup, PR links, hotkeys) while explicitly refusing to make Task an entity type at any public boundary, and left a comment saying that refusal was intentional. If the rewrite wants fidelity to Macro, that is option (b)'s shape with (c)'s product behavior layered on top. If the rewrite instead first-classes task, it is a deliberate *departure* from Macro (defensible — it would erase the resolve-subtype-on-every-property-call indirection and the "task ignores legacy DOCUMENT assignments" migration wart noted at `grouping.rs:63-64` — but it should be argued as an improvement, not as parity). One-Task-Database (Q20) is compatible with either: tasks already live in the one main DB as documents.

Owner ruling remains open; this note supplies the evidence base only.
