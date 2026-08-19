# Neuwave Postgres Schema Harvest

- **Source**: `C:\Users\Kecin\Projects\Neuwave`, git `main`, pinned SHA `9f7a26bccb85e6f806a6e0c8d6c8e53f3a3541bf`
- **Harvest date**: 2026-08-19
- **Paths**: relative to the Neuwave clone root
- **Purpose**: this is the OLD (Macro/Neuwave) data model, harvested as **design input** for the new Cloudflare-native D1/Durable-Object storage design. **No live data migrates.** Column lists are selective (PKs, FKs, discriminators, JSON columns); routine `created_at`/`updated_at` audit columns are summarized as "timestamps".

## Key structural finding: one physical Postgres, four logical databases

The platform is described as having four Postgres databases (MacroDB, CommsDB, EmailDB, NotificationDB). In this codebase they are **not separate physical databases**:

- There is exactly **one migration stream**: `crates/macro_db_client/migrations/` (267 files, sqlx-style `{timestamp}_{name}.sql`, some with `.up.sql`/`.down.sql` pairs). Every table for every "DB" is created there.
- There is exactly **one connection config**: `crates/database_env_vars/src/lib.rs` defines a single `DatabaseUrl` ("MacroDB database url") plus a `RedisUri` ("MacroCache"). No CommsDB/EmailDB/NotificationDB URLs exist.
- Cross-domain **real foreign keys** exist (e.g. `document_email` FKs to both `"Document"` and `email_attachments`; `calls` FKs to `comms_channels`; calendar tables FK to `email_links`), which is only possible in one database.
- The "databases" are **logical domains** expressed as table-name prefixes (`email_*`, `comms_*`, `notification*`/`*_notification*`) with dedicated client crates: `crates/macro_db_client`, `crates/email_db_client`, `crates/comms_db_client` (notifications are accessed via the notification service crates). All tables live in the `public` schema — there is no `CREATE SCHEMA` anywhere.

The inventory below keeps the four logical groupings since they are the real domain boundaries a rewrite must understand.

Migration counts: 202 `CREATE TABLE` statements across 61 files → **198 live tables** + 4 created-then-dropped (`Macrotation`, `UserItemAccess`, `document_task`, `email_attachments_macro`).

Naming convention note: baseline tables use Prisma-era `"PascalCase"` quoted names with camelCase columns; everything added after the baseline uses snake_case. `"User".id` is a TEXT id (the "macro id") referenced as `user_id`/`owner`/`macro_id` TEXT columns across every domain; `macro_user.id` is a newer UUID identity that `"User".macro_user_id` points at.

---

## 1. MacroDB (workspace core) — `crates/macro_db_client/migrations/`

Baseline: `0001_baseline.sql` (79 tables, plus all enums). Everything not marked otherwise below is created there.

### 1.1 Identity & accounts

| Table | Key columns | Represents |
|---|---|---|
| `User` | `id TEXT PK`, `email`, `organizationId INT`, `stripeCustomerId`, `macro_user_id UUID`, profile fields | Legacy Prisma user row; the TEXT id every other table references |
| `macro_user` | `id UUID PK`, `username`, `email`, `stripe_customer_id` | Newer canonical user identity |
| `macro_user_email_verification` | PK(`macro_user_id`,`email`), `is_verified BOOL` | Per-email verification state |
| `macro_user_info` | `macro_user_id UUID PK`, profile fields | Profile side-table for macro_user |
| `macro_user_links` | PK(`primary_macro_id`,`child_macro_id`) both FK→`User` | Links multiple accounts under a primary (`20260528154851_macro_user_links.sql`) |
| `in_progress_email_link` / `in_progress_user_link` | `id UUID PK`, `macro_user_id`, timestamps | Pending OAuth/link flows |
| `account_merge_request` | `id UUID PK`, `code`, `macro_user_id`, `to_merge_macro_user_id` | Account-merge handshake |
| `UserApiKey` | PK(`user_id`,`key`) | API keys |
| `BlockedEmail` | `email TEXT PK` | Signup blocklist |
| `promoted_shared_mailboxes` | `macro_id TEXT PK` FK→`User` | Marks shared-mailbox accounts (`20260609223922`) |
| `referral_tracking` | `id UUID PK`, `referrer_id UUID`, `referred_id UUID`, `status TEXT` | Referral program (`20260317134548`) |
| `user_onboarding` | `user_id TEXT PK`, `status` ('active'\|'completed'), `skipped BOOL` | Onboarding progress (`20260720224652`) |
| `mobile_welcome_email` | `email TEXT PK` | Mobile welcome-email dedupe (`20260415121644`) |
| `id_mapping` | `source_id TEXT PK`, `target_id TEXT` | Generic old→new id mapping (`20260122144921`) |
| `memory` | `id UUID PK`, `user_id TEXT` (unique), `memory TEXT` | Per-user AI memory blob (`20260323000000`) |
| `Experiment` / `ExperimentLog` | `id TEXT PK` / PK(`user_id`,`experiment_id`), `group VARCHAR(1)` | A/B experiments |

### 1.2 Legacy organization / enterprise (pre-teams)

All baseline; superseded by `team` but still present.

| Table | Key columns | Represents |
|---|---|---|
| `Organization` | `id SERIAL PK`, `status "OrganizationStatus"` (PILOT/ENTERPRISE), `stripeCustomerId`, `seats`, `llmProviders TEXT` | Legacy enterprise org |
| `OrganizationInvitation` | `id BIGSERIAL PK`, `email`, `organization_id` | Org invites |
| `OrganizationDefaultSharePermission` | `organization_id`, `is_public`, `public_access_level`, `organization_access_level` | Org-wide default sharing |
| `OrganizationRetentionPolicy` | `organization_id`, `retention_days` | Data retention |
| `OrganizationItJob` | `taskArn`, `taskType "OrganizationItJobType"` | IT provisioning jobs |
| `OrganizationIT` / `OrganizationEmailMatches` / `OrganizationBilling` / `EnterpriseEmailContacts` | email↔org mapping rows | IT contacts, email-domain matching, billing contacts |
| `EnterpriseRules` | `setAsDefault "SetAsDefault"`, flags | Desktop-app enterprise policy |
| `EnterpriseIManageTenants` | `tenant_uri`, `nickname` | iManage integration tenants |

### 1.3 RBAC

Baseline: `Permission`, `Role` (TEXT id + description), join tables `RolesOnPermissions`, `RolesOnOrganizations`, `RolesOnUsers` (composite PKs). Seeded/reshaped by `20251029204527_add_legacy_roles_and_permissions.sql`, `20260316195622_new_pricing_roles_and_permissions.sql`, `20260624175951_collapse_ai_permissions_to_proai.sql`.

### 1.4 Teams (current tenancy model)

| Table | Key columns | Represents |
|---|---|---|
| `team` | `id UUID PK`, `name`, `owner_id TEXT`; later ALTERs add `subscription_id`, `seat_count`, `plan "team_plan"` ('idea'…'growth', `20260514192605`), `slug`, `paying BOOL`, `enterprise BOOL`, `auto_join_domain`, `allow_non_admin_invites` | The workspace/team — primary tenancy unit |
| `team_user` | PK(`user_id`,`team_id`), `team_role "team_role"` | Membership (`20260327140350` restricts to one team per user) |
| `team_invite` | `id UUID PK`, `email`, `team_id`, `team_role`, `invited_by` | Pending invites |
| `team_task_counter` | `team_id UUID PK`, `last_task_num INT` | Per-team task numbering (`20260520130000`) |
| `team_task` | PK(`team_id`,`task_num`), `document_id` FK→`Document` (unique) | Short task ids (TEAM-42) mapped to task documents (`20260520130000`) |
| `team_crm_settings` | `team_id UUID PK`, `crm_enabled BOOL`, later `config` | Per-team CRM toggle (`20260522131111`) |

### 1.5 Documents & projects

| Table | Key columns | Represents |
|---|---|---|
| `Project` | `id TEXT PK`, `name`, `userId`, `parentId TEXT` (self-FK tree), `deletedAt`, timestamps | Folder/project tree |
| `Document` | `id TEXT PK`, `name`, `owner TEXT`, `fileType`, `branchedFromId`/`branchedFromVersionId`, `documentFamilyId BIGINT`, `projectId TEXT`, `uploaded BOOL`, `deletedAt` | Core document entity (also used as the "task" entity) |
| `DocumentFamily` | `id BIGSERIAL PK`, `rootDocumentId` | Branch family root |
| `DocumentInstance` | `id BIGSERIAL PK`, `documentId`, `sha TEXT`, `revisionName` | Content-addressed document version |
| `DocumentInstanceModificationData` | `documentInstanceId`, `modificationData JSONB` | Per-version modification overlay (comments/highlights migration flags) |
| `DocumentBom` / `BomPart` | bom per document; part = `sha`,`path`,`documentBomId` | DOCX bill-of-materials parts (content-addressed) |
| `DocumentText` | `id BIGSERIAL PK`, `documentId`, `content TEXT`, `tokenCount` | Extracted plain text for AI |
| `DocumentTextParts` | `id TEXT PK`, `reference`, `documentId` | Text-part references |
| `DocumentSummary` | `document_id`, `version_id`, `summary` | AI summaries per version |
| `DocumentProcessResult` / `JobToDocumentProcessResult` | `documentId`, `jobType`, `content`; join on `jobId` | Async processing outputs |
| `DocumentView` | `document_id`, `user_id`, `created_at` | View events |
| `document_email` | PK(`document_id`,`email_attachment_id`), FKs→`Document`,`email_attachments` | Document created from an email attachment (`20251112211315`) |
| `document_sub_type` | `document_id PK` FK→`Document`, `sub_type document_sub_type_value` | Discriminator: task/md/snippet/skill… (`20251205213515`, values extended `20260610`, `20260730`) |
| `task_duplicate_embedding` | `document_id PK` FK→`Document`, `embedding vector(1536)`, `model` | pgvector embeddings for task dedupe (`20260528120000`) |
| `task_duplicate_match` | `id UUID PK`, `task_id`/`duplicate_task_id` FK→`Document`, `status` ('active'\|'dismissed'), scores | Detected duplicate task pairs (`20260528120000`) |
| `UploadJob` | `jobId`, `jobType`, `documentId` | Upload pipeline jobs (claimed_at added `20260204000000`) |
| `InstructionsDocuments` | `documentId PK`, `userId` | User's custom-instructions doc |
| ~~`document_task`~~ | — | Created `20251204165917`, **dropped** `20251208183501` (replaced by `document_sub_type`) |

### 1.6 Annotations & comment threads (document-anchored)

| Table | Key columns | Represents |
|---|---|---|
| `Thread` | `id BIGSERIAL PK`, `owner`, `documentId`, `resolved BOOL`, `metadata JSONB`, `deletedAt` | Comment thread on a document |
| `Comment` | `id BIGSERIAL PK`, `threadId`, `owner`, `sender`, `text`, `order`, `metadata JSONB` | Comment in a thread |
| `ThreadAnchor` | `threadId BIGINT`, `anchorId UUID`, `anchorTableName "anchor_table_name"` | Polymorphic thread→anchor pointer (enum: PdfPlaceableCommentAnchor, PdfHighlightAnchor) |
| `PdfPlaceableCommentAnchor` | `uuid PK`, `documentId`, `page`, x/y/width/height pct, `threadId` | Placed PDF comment anchor |
| `PdfHighlightAnchor` / `PdfHighlightRect` | `uuid PK`, `documentId`, color, `text`, `threadId`; rects per anchor | PDF highlight geometry |
| ~~`Macrotation`~~ | — | Legacy annotation table, **dropped** `20260326135457` |

### 1.7 Sharing & access control

| Table | Key columns | Represents |
|---|---|---|
| `SharePermission` | `id TEXT PK`, `isPublic BOOL`, `publicAccessLevel TEXT` | Shareable permission object |
| `DocumentPermission` / `ChatPermission` / `ProjectPermission` / `MacroPromptPermission` | `<entity>Id PK` → `sharePermissionId` | One SharePermission per entity |
| `EmailThreadPermission` | `threadId TEXT PK`, `sharePermissionId`, `userId`, `projectId` (added `20260319232323`) | Shared email threads |
| `ChannelSharePermission` | PK(`channel_id`,`share_permission_id`), `access_level "AccessLevel"` (view/comment/edit/owner) | Entity shared into a channel |
| `entity_access` | `id BIGSERIAL PK`, `entity_id UUID`, `entity_type TEXT`, `source_id TEXT`, `source_type entity_access_source_type`, `access_level "AccessLevel"`, `granted_from_project_id` | **Current** generic ACL: (entity ← source) grants, source can be user/team/channel (`20260331152752`) |
| ~~`UserItemAccess`~~ | — | Baseline predecessor of `entity_access`, **dropped** `20260707154258` |
| `WebsocketConnectionPermissions` | `connectionId TEXT PK`, `userId`, `permissions JSONB` | Per-WS-connection capability snapshot |

### 1.8 AI chat (assistant metadata; "chat metadata" domain)

| Table | Key columns | Represents |
|---|---|---|
| `Chat` | `id TEXT PK`, `userId`, `name`, `model TEXT` (default 'gpt-4o'), `projectId`, `isPersistent`, `tokenCount`, `deletedAt` | AI chat session |
| `ChatMessage` | `id TEXT PK`, `chatId`, `role TEXT`, `content JSONB`, `model` (`isPartial` dropped `20251124210006`) | Chat message (rich JSON content) |
| `ChatAttachment` | `id TEXT PK`, `chatId`, `messageId`; columns migrated to `entity_type TEXT` + `entity_id UUID` (`20260430120001_chat_attachment_to_entity.up.sql`; old `attachmentType`/`attachmentId` kept as `old_*`) | Entity attached to a chat/message (document, static_file, channel, email_thread, project) |
| `resolved_message_content` | `messageId` unique FK→`ChatMessage`, `content JSONB` | Fully-resolved message content snapshot (`20260425120000`) |
| `Artifact` | PK(`messageId`,`digest`), `documentId`, `userId` | AI-generated artifact tied to a message |
| `WebAnnotations` | `id TEXT PK`, `messageId`, `chatId`, `url`, `title` | Web citation metadata for messages |
| `MacroPrompt` / `MacroPromptAttachment` | `id TEXT PK`, `title`, `prompt`, `user_id`; attachments by `attachment_type`/`attachment_id` | Saved prompt templates |
| `scheduled_action` | `id UUID PK`, `owner` FK→`User`, `schedule TEXT` (cron), `kind`, `timezone`, `task JSONB`, `next_run_at`, `enabled`, `claimed` | Scheduled agent runs (`20260416135258_scheduled_agent.up.sql`) |
| `action_execution_record` | `action_id` FK, `is_success`, `result JSONB` | Scheduled-action run history |
| `mcp_servers` | PK(`user_id`,`url`), `server_name`, `credentials BYTEA`, `enabled` | Per-user MCP server registrations (`20260512000001`) |

### 1.9 AI insights, usage & projections

| Table | Key columns | Represents |
|---|---|---|
| `InsightContext` | `providerSource`, `userId`, `resourceId`, `consumed BOOL` | Raw context queued for insight extraction |
| `UserInsights` | `id TEXT PK`, `userId`, `content`, `source`, `sourceLocation JSONB`, `insightType`, `relevanceKeywords TEXT[]` | Extracted per-user insights |
| `UserInsightBatch` | `userId`, `insightIds TEXT[]`, `rankingContext JSONB`, `expiresAt` | Ranked insight batches |
| `EmailInsightsBackfillJob` / `EmailInsightsBackfillBatch` | job status enums, `threadIds TEXT[]`, counters | Email-insight backfill pipeline |
| `ai_pricing` | `model TEXT PK`, `price_per_million_in/out REAL` | Model pricing (seed migrations add models over time) |
| `ai_usage` | `id UUID PK`, `feature`, `user_id`, `entity UUID`, `model`, `input_tokens`/`output_tokens`, `total` | Token/cost metering (`20260616194726`) |
| `ai_projection` | `id TEXT PK`, `prompt`, `prompt_hash`, `target_type` ('user'\|'team'), `refresh_cadence`, `expiry`; later `model`, `output_schema` | Registered AI projection definitions (`20260622133041`) |
| `user_ai_projection` | PK(`target_id`,`ai_projection_id`), `status` ('loading'/'cold'/'ready'/'refreshing'/'error'), `result TEXT` | Materialized projection per target |
| `processing_ai_projections` | PK(`ai_projection_id`,`target_id`) | In-flight projection lock (`20260622200718`) |

### 1.10 Activity, navigation & personalization

| Table | Key columns | Represents |
|---|---|---|
| `UserHistory` | PK(`userId`,`itemId`,`itemType`) | Recently-touched items (polymorphic) |
| `UserDocumentViewLocation` | PK(`user_id`,`document_id`), `location TEXT` | Scroll/cursor position resume |
| `ItemLastAccessed` | PK(`item_id`,`item_type`) | Global last-access per item |
| `Pin` | PK(`userId`,`pinnedItemId`,`pinnedItemType`), `pinIndex` | Pinned items |
| `favorite` | PK(`user_id`,`entity_type`,`entity_id`), `sort_order DOUBLE` | Favorites (`20260702014623`) |
| `frecency_events` / `frecency_aggregates` | `user_id`,`entity_type`,`entity_id`; aggregate has `frecency_score`, `recent_events JSONB` | Frecency ranking pipeline (`20251029143441`) |
| `saved_view` | `id UUID PK`, `user_id`, `config JSONB` | Saved list-view configurations |
| `excluded_default_view` | `user_id`, `default_view_id TEXT` | Hidden built-in views |
| `activity_events` | `id UUID PK` (uuidv5, idempotent), `actor_id TEXT` (prefixed principal 'macro\|…','bot\|…'), `subject_id`, `action`, `action_payload JSONB`, `entity_type`/`entity_id`, `occurred_at` | Append-only activity fact log (`20260805180315`) |
| `active_streams` | PK(`entity_id`,`stream_key`) | Live-stream presence markers (`20260217194926`) |

### 1.11 Custom properties (EAV)

`20251030100000_init_properties_schema.sql` (org ownership later replaced by team: `20260622223029_kill_org_properties_add_team.sql`; system properties seeded `20251128000000`/`20251128000001`, tag type added `20260629214704`).

| Table | Key columns | Represents |
|---|---|---|
| `property_definitions` | `id UUID PK`, owner (`organization_id` → later `team_id`) or `user_id`, `display_name`, `data_type property_data_type`, `is_multi_select BOOL`, `specific_entity_type property_entity_type` | Property schema definition |
| `property_options` | `id UUID PK`, `property_definition_id` FK, `number_value` XOR `string_value`, `display_order` | Select options |
| `entity_properties` | `id UUID PK`, `entity_id TEXT` + `entity_type` (**no FK — polymorphic**), `property_definition_id` FK, `values JSONB` **tagged union** `{"type": "Boolean"\|"Number"\|"String"\|"Date"\|"SelectOption"\|"EntityReference"\|"Link", "value": …}` with CHECK enforcing array-ness | Property value per entity — attaches metadata to any entity in any domain |

### 1.12 CRM

`20260512120000_crm_tables.up.sql` and follow-ups (name/hidden/updated_at/interaction timestamps/manually_created columns added by later `.up.sql` migrations).

| Table | Key columns | Represents |
|---|---|---|
| `crm_companies` | `id UUID PK`, `team_id` FK→`team`, `name`, `email_sync BOOL`; later `hidden`, `name`, interaction timestamps | CRM company, team-scoped, auto-populated from email |
| `crm_domains` | `company_id` FK, `domain` (unique per company); later `team_id` | Company email domains |
| `crm_contacts` | `id UUID PK`, `company_id` FK, `email` (unique per company); later `name`, `manually_created` | CRM contact |
| `crm_contact_sources` | `contact_id` FK, `link_id` FK→`email_links` | Which mailbox produced the contact (`20260514120000`) |
| `crm_domain_directory` | `domain`, `name`, `description`, `icon_url`; later Apollo enrichment fields | Global domain→company enrichment directory (`20260521120000`) |
| `crm_thread` | `id uuid PK`, `company_id` XOR `contact_id` (CHECK num_nonnulls=1), `owner` FK→`User`, `resolved`, `metadata jsonb` | Comment thread on a CRM record (`20260527194808`) |
| `crm_comment` | `thread_id` FK, `owner`, `text`, `order`, `metadata jsonb` | CRM comment |
| `crm_cleanup_candidates` | identity PK, `link_id` FK→`email_links`, `contact_email` | Contacts flagged for cleanup (`20260723160259`) |
| `crm_cleanup_jobs` | `id UUID PK`, `status crm_cleanup_job_status`, `max_candidate_id` | Cleanup batch jobs |

### 1.13 Calls & voice

`20260331170640_add_call_tables.sql` (+ later: recording_key, share-with-team, summary, custom name, preview URL, diarized/custom speaker, voice_id columns).

| Table | Key columns | Represents |
|---|---|---|
| `calls` | `id UUID PK`, `channel_id` FK→`comms_channels` (UNIQUE — one live call per channel), `room_name`, `created_by`, `egress_id`, `recording_url` | Live call (LiveKit room) |
| `call_participants` | PK(`call_id`,`user_id`), `joined_at`/`left_at` | Live-call membership |
| `call_transcripts` | `call_id` FK, `segment_id`, `speaker_id`, `content`, `sequence_num` | Live transcript segments |
| `call_records` | `id UUID PK`, `channel_id` FK→`comms_channels`, `started_at`/`ended_at`, `duration_ms`, `recording_url` | Finished-call record (+summary, custom name, preview) |
| `call_record_participants` / `call_record_transcripts` | mirrors of the live tables against `call_record_id` | Archived participants/transcript |
| `voice` | `id UUID PK`, `embedding vector(256)` | Speaker voiceprint (pgvector, `20260511131822`) |
| `macro_user_voice` | PK(`macro_user_id`,`voice_id`) | User↔voiceprint mapping |

### 1.14 Calendar

`20260725014930_calendar_entities.sql` (+ `20260810154320_calendar_override_attendees.sql`). Heavily CHECK-constrained; all rooted in `email_links`.

| Table | Key columns | Represents |
|---|---|---|
| `calendar_accounts` | `id uuid PK`, `owner_id text`, `email_link_id` UNIQUE FK→`email_links`, `provider` ('google'), `sync_status` | Connected calendar account |
| `calendars` | `account_id` FK, `provider_calendar_id`, `sync_token`, watch-channel fields, materialized-range fields | Individual calendar + sync watch state |
| `calendar_events` | `id uuid PK`, `owner_id`, `source_link_id` FK→`email_links`, `ical_uid`, timed XOR all-day shape CHECK, `recurrence_lines text[]`, `canonical_source_kind` ('google'\|'email_ics') | Canonical event |
| `calendar_event_sources` | `event_id`+`source_link_id` composite FK, `source_kind` shape CHECK (google: account/calendar/provider_event_id; email_ics: email_link/message/content_hash), `raw_payload jsonb`, `normalized_payload jsonb` | Per-source evidence for an event (dedupes google vs .ics) |
| `calendar_event_attendees` | PK(`event_id`,`email`), `response_status` | Attendees |
| `calendar_event_overrides` / `calendar_event_override_attendees` | PK(`event_id`,`recurrence_id`) (+`email`) | Recurrence-instance exceptions |
| `calendar_event_occurrences` | PK(`event_id`,`occurrence_key`), generated `timed_span tstzrange` / `day_span daterange` | Materialized occurrences for range queries |
| `calendar_backfill_jobs` | `email_link_id` FK, `kind` ('google_calendar'\|'email_ics'), `grant_version`, `status`, `cursor jsonb`, lease fields | Calendar backfill with leases |
| `calendar_sync_outbox` | `backfill_job_id` UNIQUE FK | Outbox row for sync kickoff |

### 1.15 GitHub integration

| Table | Key columns | Represents | Migration |
|---|---|---|---|
| `github_links` | `id UUID PK`, `macro_id` FK→`User`, `github_user_id`, `github_username` | User↔GitHub account link | `20260226142003` |
| `github_pr_tasks` | `github_key` ('org:repo:pr_number'), `task_id` (short task id), later `team_id` | PR↔task association | `20260305182148` |
| `github_app_installation_team` | PK(`id`,`team_id`), `installed_by` | Installation↔team (early form) | `20260323152227` |
| `github_app_installation` | PK(`id`,`source_id`,`source_type github_app_installation_source_type`) | Installation↔team-or-user | `20260527141944` |
| `github_app_installation_installer` | `installation_id PK`, `github_user_id` | Who installed | `20260708172449` |
| `github_app_installation_request` | `github_user_id PK`, `source_id`,`source_type` | Pending install requests | `20260804132220` |

### 1.16 Bots & webhooks

| Table | Key columns | Represents | Migration |
|---|---|---|---|
| `bots` | `id uuid PK`, `kind` ('owned'\|'system') with owner CHECK (`owner_user_id` XOR `team_id` for owned), `handle`, `deleted_at` | Bot identities that participate in channels | `20260527160000` |
| `bot_tokens` | `bot_id` FK, `token_hash bytea`, `token_prefix`, `expires_at`, `revoked_at` | Bot API tokens | `20260527160000` |
| `webhook` | `id TEXT PK`, `workspace_id`, `owner_user_id`/`owner_bot_id`, `endpoint_url`, `signing_secret`, `headers JSONB`, `rule JSONB` (event filter), `status` ('active'/'paused'/'disabled'); later namespace | Outbound webhook registration | `20260629135403` |
| `webhook_delivery` | `webhook_id` FK, `event_id` (UNIQUE per webhook), `event_entity_type`/`event_entity_id`, `event_ordering_key`, `request_body JSONB`, retry fields | One event delivery | `20260629135403` |
| `webhook_delivery_attempt` | `webhook_delivery_id` FK, `attempt_number`, `response_status`, error fields | Per-attempt log | `20260629135403` |

### 1.17 Import & foreign entities

| Table | Key columns | Represents | Migration |
|---|---|---|---|
| `foreign_entity` | `id UUID PK`, `foreign_entity_id`+`foreign_entity_source`, `metadata JSONB`, `stored_for_id`+`stored_for_auth_entity` | Live reference to an item staying in an external system | `20260526175912` |
| `import_entity` | `id UUID PK`, `user_id`, `team_id` FK, `source` ('linear'\|'notion'\|'slack'), `foreign_id`, `status` ('staged'/'importing'/'imported'/'discarded'), `initiator` ('onboarding'\|'chat'), `metadata JSONB`, `entity_id`/`entity_type` ('task'\|'md'\|'channel') | Ledger of items being COPIED into Macro | `20260720221050` |
| `import_run` | PK(`user_id`,`source`), `status` ('running'/'ready'/'failed'/'dismissed') | Gather-job state per connector | `20260720221050` |

### 1.18 Contacts graph & reminders

| Table | Key columns | Represents | Migration |
|---|---|---|---|
| `contacts_connections` | `user1`/`user2 TEXT` (UNIQUE, ordered CHECK) | Who-knows-whom edges for @-mention ranking | `20260126191437` |
| `contacts_backfill_outbox` | `comms_channel_id` FK, `user_ids jsonb`, `applied_at` | Outbox to backfill connections from channels | `20260429140000` |
| `reminder` | `id UUID PK`, `user_id` FK→`User`, `description`, polymorphic `entity_type TEXT`+`entity_id UUID` (both-or-neither CHECK), one-shot `remind_at` XOR recurring `cron`+`timezone`, `next_run_at`, `enabled`, `completed_at` | User reminders, optionally attached to any entity | `20260729145833` |
| `reminder_occurrence` | `reminder_id` FK, `scheduled_for`, `sent_at` | Fired occurrences | `20260729145833` |

**MacroDB total: 154 live tables** (+3 dropped: `Macrotation`, `UserItemAccess`, `document_task`).

---

## 2. EmailDB (logical) — `email_*` tables, same migration dir

Bulk schema: `20251030154634_email_db_schema.sql` (17 tables); later additions noted per row. Client crate: `crates/email_db_client`.

| Table | Key columns | Represents | Created in |
|---|---|---|---|
| `email_links` | `id uuid PK`, `macro_id text` (→`User.id`), `fusionauth_user_id text`, `email_address varchar(320)`, `provider email_user_provider_enum`, `is_sync_active bool`; later `is_primary`, reauth-health columns | A connected mailbox (the root of everything email) | `20251030154634` |
| `email_links_history` | `link_id`, `deleted_at`, `deletion_reason` | Audit of removed links | `20260410144431` |
| `email_link_google_scopes` | `link_id PK` FK, `granted_scopes text[]`, `grant_version bigint` | OAuth scope tracking side-table | `20260804194138` |
| `email_settings` | `link_id PK` FK, `signature_on_replies_forwards`; later `signature` | Per-mailbox settings | `20251117204659` |
| `email_filters` | `id UUID PK`, `link_id` FK, `email_address` XOR `email_domain` CHECK, `is_important BOOL` | Importance filters | `20260325102949` |
| `email_threads` | `id uuid PK`, `provider_id text`, `link_id uuid`, `inbox_visible`, `is_read`, `latest_*_message_ts`; later `project_id` (`20260319232323`), `has_calendar_attachment`, `is_signal` | Email thread per mailbox | `20251030154634` |
| `email_messages` | `id uuid PK`, `provider_id`, `thread_id uuid`, `link_id uuid`, `subject`, `from_contact_id uuid`, `sent_at`, flags (`is_read`/`is_starred`/`is_sent`/`is_draft`), `body_text`/`body_html_sanitized`/`body_macro`, `headers_jsonb jsonb`, `global_id text`, `replying_to_id uuid`; later from_name etc. | Email message incl. drafts | `20251030154634` |
| `email_message_labels` | (`message_id`,`label_id`) | Message↔label join | `20251030154634` |
| `email_message_recipients` | (`message_id`,`contact_id`,`recipient_type email_recipient_type`) | To/Cc/Bcc recipients | `20251030154634` |
| `email_labels` | `id uuid PK`, `link_id`, `provider_label_id`, `name`, visibility enums, `type email_label_type_enum` | Gmail-style labels | `20251030154634` |
| `email_contacts` | `id uuid PK`, `link_id`, `email_address`, `name`, photo URLs | Per-mailbox address book entries | `20251030154634` |
| `email_contact_search_index` | (`link_id`,`thread_id`,`message_id`,`contact_email`,`contact_type`) | Denormalized contact-search rows | `20260311180000` |
| `email_attachments` | `id uuid PK`, `message_id uuid`, `provider_attachment_id`, `filename`, `mime_type`, `size_bytes`, `content_id` | Attachment metadata | `20251030154634` |
| `email_attachments_sfs` | `attachment_id` FK, `sfs_id UUID` | Attachment stored in SFS (static file service) | `20251209162953` |
| `email_attachments_drafts` | `draft_id` FK→`email_messages`, `file_name`, `sha`, `s3_key` UNIQUE | Draft attachments in S3 | `20260106210823` |
| `email_attachments_fwd` | (`message_id`,`attachment_id`) FKs | Attachments carried into forwards | `20260212192413` |
| `email_scheduled_messages` | (`link_id`,`message_id`), `send_time`, `sent`; later `processing BOOL` | Send-later queue | `20251030154634` |
| `email_sfs_mappings` | `source`→`destination` | SFS URL rewrite map | `20251030154634` |
| `email_sync_tokens` | `link_id`, Google contacts sync tokens | People-API sync cursors | `20251030154634` |
| `email_gmail_histories` | `link_id`, `history_id text` | Gmail incremental-sync cursor | `20251030154634` |
| `email_user_history` | (`link_id`,`thread_id`) | Recently-viewed threads | `20251030154634` |
| `email_backfill_jobs` | `id uuid PK`, `link_id`, `fusionauth_user_id`, `status email_backfill_job_status`, many counters | Mailbox backfill job | `20251030154634` |
| `email_backfill_threads` / `email_backfill_messages` | (`backfill_job_id`,`*_provider_id`), status enums, counters | Per-thread/message backfill state | `20251030154634` |
| `email_backfill_init_outbox` / `email_backfill_completion_outbox` | `backfill_job_id` UNIQUE FK, `published_at`, lease fields | Transactional outboxes for backfill orchestration | `20260725014930` |
| ~~`email_attachments_macro`~~ | — | Attachment↔macro-item mapping, **dropped** `20260121112345` | `20251030154634` |

**EmailDB total: 26 live tables** (+1 dropped). Note `20251111151333_email_backfill_redis.sql` — part of backfill state was moved to Redis.

---

## 3. CommsDB (logical) — `comms_*` tables, same migration dir

Bulk schema: `20251104101012_comms_db_schema.sql` (7 tables). Client crate: `crates/comms_db_client`.

| Table | Key columns | Represents |
|---|---|---|
| `comms_channels` | `id uuid PK`, `name` (NULL for DMs — CHECK), `channel_type comms_channel_type` ('public'/'organization'(removed `20260601`)/'private'/'direct_message'/'team' (added `20260324`)), `org_id bigint`, `owner_id text`; later `join_code`, `auto_join_team` | Channel / DM / team channel |
| `comms_channel_participants` | (`channel_id`,`user_id`), `role comms_participant_role`, `joined_at`/`left_at` | Membership (soft-leave via `left_at`) |
| `comms_messages` | `id uuid PK`, `channel_id uuid`, `thread_id uuid` (NULL = top-level), `sender_id text`, `content text`, `edited_at`, `deleted_at`; later `triggered_by` (`20260629171949`) | Message; threads are keyed by parent message id |
| `comms_reactions` | (`message_id`,`emoji`,`user_id`) | Emoji reactions |
| `comms_attachments` | `id uuid PK`, `message_id`, `channel_id`, polymorphic `entity_type varchar(32)` + `entity_id` ; later width/height (`20251211161224`) | Entity attached to a message (document, file, email thread…) |
| `comms_activity` | `id uuid PK`, `user_id`, `channel_id`, `viewed_at`, `interacted_at` | Per-user channel read/interaction state |
| `comms_entity_mentions` | `id uuid PK`, `entity_type`+`entity_id` (mentioned), `source_entity_type`+`source_entity_id` (where), `user_id` | Cross-entity mention graph (bot-mention ids normalized `20260702200905`) |

**CommsDB total: 7 live tables.** (Calls — §1.13 — FK directly into `comms_channels`.)

---

## 4. NotificationDB (logical) — notification tables, same migration dir

Bulk schema: `20260126170641_create_notification_tables.sql` (9 tables) + 2 later.

| Table | Key columns | Represents | Created in |
|---|---|---|---|
| `notification` | `id UUID PK` (UUIDv7), `notification_event_type varchar(255)`, polymorphic `event_item_id`+`event_item_type`, `service_sender`, `sender_id`, `metadata JSONB` (NOT NULL since `20260202190211`), `apns_collapse_key`; later secondary entity (`20260618145754`) | A notification event (fan-out source) | `20260126170641` |
| `user_notification` | PK(`user_id`,`notification_id` FK CASCADE), `sent`, `seen_at`, `deleted_at`, `done`, `is_important_v0` | Per-recipient delivery/read state | `20260126170641` |
| `notification_message_receipt` | `message_id TEXT PK`, composite FK→`user_notification` | Provider message-id receipt for a delivered notification | `20260213120000` |
| `notification_user_device_registration` | `id UUID PK`, `user_id`, `device_token`, `device_endpoint` UNIQUE, `device_type notification_device_type_option` (ios/android, +iosvoip `20260501`) | Push device registrations | `20260126170641` |
| `user_notification_type_preference` | PK(`user_id`,`notification_event_type`) | Per-type opt-out | `20260325181013` |
| `user_notification_item_unsubscribe` | PK(`user_id`,`item_id`), `item_type` | Mute a specific item | `20260126170641` |
| `user_mute_notification` | `user_id PK` | Global mute | `20260126170641` |
| `notification_email_unsubscribe` / `notification_email_unsubscribe_code` | `email PK`; code table adds `code UUID` UNIQUE | Email digest unsubscribe + link codes | `20260126170641` |
| `notification_email_sent` | `user_id PK`, `sent_at` | Last digest-email timestamp | `20260126170641` |
| `channel_notification_email_sent` | PK(`channel_id`,`user_id`) | Per-channel email-notification dedupe (channel_id is a comms channel by convention) | `20260126170641` |

**NotificationDB total: 11 live tables.** `20260423120000_cascade_comms_message_delete_to_notifications.sql` wires comms deletions into notification cleanup — further proof of single-DB.

---

## 5. Cross-domain relationships

Because everything is one Postgres database, cross-"DB" references are a mix of real FKs and by-convention ids:

**Real FKs across domain lines** (would become cross-service references in a split design):
- `document_email.email_attachment_id` → `email_attachments` (MacroDB ↔ EmailDB)
- `calls.channel_id`, `call_records.channel_id`, `contacts_backfill_outbox.comms_channel_id` → `comms_channels` (MacroDB ↔ CommsDB)
- `crm_contact_sources.link_id`, `crm_cleanup_candidates.link_id`, all `calendar_*` tables, `email_settings`, `email_filters`, `email_link_google_scopes` → `email_links` (MacroDB/CalendarDB ↔ EmailDB)
- `github_links.macro_id`, `scheduled_action.owner`, `reminder.user_id`, `favorite.user_id`, `crm_thread.owner`, `mcp_servers.user_id`, `macro_user_links.*` → `"User"(id)`

**By-convention (no FK) references — the dominant pattern:**
- `"User".id` (TEXT macro id) is referenced as untyped TEXT (`user_id`, `owner`, `sender_id`, `macro_id`, `owner_id`, `created_by`) in every domain: comms, email (`email_links.macro_id`), notifications, calls, activity.
- `email_links.fusionauth_user_id` ties mailboxes to the external FusionAuth identity provider.
- **Polymorphic `entity_type` + `entity_id` pairs** appear in at least 10 tables and are the platform's universal cross-domain glue: `entity_properties`, `entity_access`, `comms_attachments`, `comms_entity_mentions`, `ChatAttachment`, `favorite`, `activity_events`, `reminder`, `notification` (`event_item_id`/`event_item_type`), `UserHistory`/`Pin`/`ItemLastAccessed` (`item_id`/`item_type`), `frecency_*`, `webhook_delivery` (`event_entity_*`). Entity types span documents, projects, chats, channels, email threads, calls, CRM records.
- `EmailThreadPermission.threadId` (TEXT) → `email_threads.id` (uuid) by convention; `channel_notification_email_sent.channel_id` → `comms_channels.id`; `notification` rows point at comms messages/channels, email threads, documents via `event_item_*`.
- The `reminder` migration comment documents the id-type situation explicitly: email_threads/comms_channels/calls/crm rows are native uuid; `"Document"`/`"Chat"`/`"Project"` hold uuid values in TEXT columns "pending their own migration".

---

## 6. Other data stores discovered (not Postgres)

- **DynamoDB**: `crates/dynamodb_client` — a `BulkUploadRequest` table (bulk document upload state). No SQL migrations.
- **Redis** ("MacroCache", `RedisUri` in `crates/database_env_vars`); `20251111151333_email_backfill_redis.sql` indicates email-backfill state partially lives there.
- **Client-side SQLite cache**: `crates/client/cache-sqlite` (CREATE TABLE in Rust code) — local cache, not server schema.
- **Cloudflare D1 / SQLite service DBs**:
  - `services/sync-service/database/user-peer-mapping/migrations/` — `peer_user_map`, `blame` (comment: "peer_id should be BIGINT, but d1 doesn't support this" → already D1). CRDT peer↔user mapping and blame for collaborative editing.
  - `services/ai-editing-worker/migrations/` — `edit_traces` (id, document_id, trace_json) — AI edit session traces.
- **Test-only Postgres mirrors**: `services/{delete_chat_handler,document_text_extractor,organization_retention_handler,organization_retention_trigger,sha_cleanup_worker}/migrations/20240325143515_basic_schema_for_testing.sql` — hand-copied snapshot of the main schema, explicitly never applied to prod (useful as a one-file reference for baseline enums like `AccessLevel`, `comms_channel_type`, `comms_participant_role`).
- **S3 / SFS**: attachment bytes live outside Postgres (`s3_key` in `email_attachments_drafts`, `sfs_id` in `email_attachments_sfs`); document content is content-addressed by `sha` (DocumentInstance/BomPart) in blob storage.

---

## 7. Summary

| Logical DB | Live tables | Migrations location |
|---|---|---|
| MacroDB (workspace core) | 154 | `crates/macro_db_client/migrations/` (shared stream, 267 files) |
| EmailDB (`email_*`) | 26 | same |
| CommsDB (`comms_*`) | 7 | same |
| NotificationDB | 11 | same |
| **Total** | **198** (+4 dropped) | |

### Tables a rewrite must understand first

1. **`"User"` / `macro_user` / `team` / `team_user`** — identity and tenancy; the TEXT `User.id` is the universal foreign key by convention, teams are the tenancy unit.
2. **`Document` + `DocumentInstance` (sha-addressed versions) + `document_sub_type`** — documents double as tasks/notes/skills via the sub_type discriminator; content lives in blob storage keyed by sha.
3. **`Project`** — the folder tree (`parentId` self-reference) that scopes documents, chats, and email threads.
4. **`comms_channels` / `comms_channel_participants` / `comms_messages`** — messaging core; threads are messages with `thread_id`; calls hang off channels.
5. **`email_links` → `email_threads` → `email_messages` (+ `email_contacts`, `email_attachments`)** — the mailbox model; everything email is scoped by `link_id` (a connected mailbox), not by user.
6. **`Chat` / `ChatMessage` (content JSONB) / `ChatAttachment` (entity_type/entity_id)** — AI-assistant sessions and their entity attachments.
7. **`entity_access`** — the current generic ACL (entity ← user/team/channel source with AccessLevel), replacing the older per-entity `*Permission` tables which still exist.
8. **`property_definitions` / `property_options` / `entity_properties`** — the EAV custom-property system with a tagged-union JSONB value format, attachable to any entity type.
9. **`notification` / `user_notification`** — event fan-out with per-recipient state; polymorphic `event_item_*` pointers into every other domain.
10. **`crm_companies` / `crm_contacts` (+ `crm_domains`, sources)** — team-scoped CRM auto-populated from email mailboxes.

Design signals worth carrying forward: pervasive polymorphic `entity_type`/`entity_id` references instead of FKs (maps naturally to DO-per-entity or a D1 entity registry); transactional outbox tables (`*_outbox`) for cross-service effects; lease columns (`lease_token`/`lease_expires_at`, `claimed`) for job dispatch; content-addressing (`sha`) for document blobs; pgvector usage (`voice`, `task_duplicate_embedding`) that will need Vectorize or equivalent; and the half-finished TEXT→UUID id migration explicitly noted in the `reminder` migration.
