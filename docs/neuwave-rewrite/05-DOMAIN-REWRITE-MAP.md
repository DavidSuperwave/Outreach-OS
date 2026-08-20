# Domain rewrite map

The closed ledger—not this summary—owns final keep/kill/defer verdicts. This map tells Codex what must be designed for each kept capability.

| Domain family | Preserve | Cloudflare-native design question | First parity proof |
|---|---|---|---|
| Identity, account, teams | Sign-in, account identity, team membership, admin policy | Access/auth Gatekeepers, User DO, team/tenant authority | Existing user signs in and resolves identical effective role. |
| Entity ontology and access | Canonical entity types, per-type policy, share semantics | Entity registry, policy engine, typed authorization receipt | Same user/entity matrix produces expected view/comment/edit/owner result. |
| Workspaces, splits, routes | Deep links, navigation history, panes, mobile behavior | Custom React shell over RPC; route-state codec | Reload and share a multi-surface route without losing layout state. |
| Soup/list engine | Tabs, grouping, filters, saved views, live updates | Projection/query API, D1 indexes, subscription model | One mixed list reproduces filters, ordering, pagination, and update behavior. |
| Documents and projects | Entity lifecycle, content-location model, versions, folders, upload jobs | DO authority + R2 + sync-service integration + projections | Create/edit/version/move/restore one document and see lists update. |
| Tasks and properties | Task subtype, status/owner/delegate/due, bulk property edits | Typed property values on entity + materialized indexes | Bulk edit grid and kanban transition remain consistent. |
| Channels and messages | Channels, DMs, messages, threads, bots, realtime | Channel DOs, message log, subscriptions, external gateway | Two users and one agent exchange ordered messages and reconnect safely. |
| Company mailbox and email | Mailbox/inbox, threads, compose/send/sync as ruled | Gatekeeper/external service, message authority, sync checkpoints | Read/sync one thread and execute an approved write with audit trail. |
| Calendar and calls | Events, call records, transcripts, LiveKit-facing behavior | External providers + domain metadata and permissions | One event/call opens from Soup and obeys access rules. |
| CRM | Company/contact records, enrichment, links to activity/email | DO/D1 model and projection feeds | Company view reconciles linked contacts, email activity, and properties. |
| Search | Seven-source search, ranking, enrichment | Query router over FTS/vector/provider sources | Golden query set matches source coverage and ranking tolerances. |
| Activity, history, recents, favorites | Append-only facts, frecency, ordering, personal collections | Event consumers, per-user state, projection hydration | Same activity stream yields stable recents/favorites ordering. |
| Notifications | Types, preferences, unread, egress | Notification authority, delivery queue, push/email channels | Idempotent notification appears once and unread state reconciles. |
| Agents, tools, memory, MCP | Agent sessions, tools, approvals, callbacks, memory | Adopt Overseer/Gatekeeper runtime; map old concepts | Agent reads a capability, proposes a write, receives approval, resumes. |
| Webhooks and integrations | Inbound/outbound delivery, retries, signatures | `/hooks/*` or Gatekeeper routes, queue/outbox | Duplicate webhook is processed once and delivery status is inspectable. |
| Static files, unfurl, image proxy | Upload/download, metadata, transforms, safe fetching | R2/file worker, SSRF policy, caches | Authorized file fetch and safe unfurl pass adversarial tests. |
| Converter | DOCX/PDF/media conversions | Controlled self-hosted exception or service boundary | Golden conversion fixtures pass with deterministic failure reporting. |
| Billing, onboarding, getting started | Mechanical primitives, separate owner-designed business experience | Parked redesign; do not accidentally delete primitives | Owner-approved flow spec before implementation. |

## Required domain specification

Before implementation, every domain receives a `templates/domain-spec.md` filled with:

- source behavior and pointers;
- owner ruling;
- user journeys;
- invariants;
- aggregate/state owner;
- storage/projection model;
- API/RPC contract;
- commands/hotkeys;
- authorization matrix;
- asynchronous flows;
- migration plan;
- parity tests;
- observability and SLOs;
- failure, retry, and rollback behavior.
