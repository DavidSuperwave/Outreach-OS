# Platform context revision agent brief

> Hand this file to an agent that must review or revise Macro's internal
> platform documentation.
>
> Documentation root: `docs/internal/platform-context/`
> Authority: current code and generated contracts override these documents

## Mission

Revise the platform-context documentation so another engineer, designer, or
agent can locate the current implementation of a feature without performing a
repository-wide investigation.

The revision must preserve the connection between:

```text
user capability
→ route or split
→ component tree
→ query and service client
→ deployable and domain crate
→ database, queue, stream, or external integration
```

Do not document roadmap intent as current behavior. If code evidence is
incomplete, label the mapping **Uncertain** and identify the evidence that is
missing.

## Assignment

Replace these placeholders when the revision has a targeted scope. If this
section is handed to an agent unchanged, the agent must run the full-folder
current-state audit described below and must not wait for clarification.

```text
REVISION GOAL:
<What should be corrected, expanded, or audited?>

TARGET FEATURES:
<Feature domains, UI areas, routes, or services in scope>

EXPECTED OUTPUT:
<Documentation edits, audit report, implementation proposal, or all three>

OUT OF SCOPE:
<Areas the agent must not change>

KNOWN QUESTIONS:
<Claims or integrations that need confirmation>
```

If no narrower scope is supplied, treat the assignment as a current-state
accuracy audit of all files in this folder and begin immediately. Do not modify
product code during a documentation-only audit.

## Required reading

Read only the entrypoint and the documents relevant to the assignment:

1. [`README.md`](./README.md) — authority, vocabulary, context-loading rules,
   known caveats, and the previous coverage snapshot.
2. [`feature-map.md`](./feature-map.md) — features, routes, split IDs,
   component trees, clients, service ownership, flags, and chat/agent detail.
3. [`platform-canvas.md`](./platform-canvas.md) — deployables, mounted Rust
   domains, API contracts, stores, queues, and end-to-end flows.
4. [`ui-ux-component-catalog.md`](./ui-ux-component-catalog.md) — design
   primitives, app chrome, shared components, feature families, blocks,
   assets, tokens, and galleries.

Default context rule:

- Route or feature revision: load `README.md` and `feature-map.md`.
- Backend/service revision: load `README.md` and `platform-canvas.md`.
- UI/UX revision: load `README.md` and `ui-ux-component-catalog.md`.
- Chat/agent revision: load the Chat and Agents section of `feature-map.md`,
  then the AI flow in `platform-canvas.md`.
- Load all documents only when the assignment crosses all layers.

## Where to verify claims

### Routes, views, splits, and blocks

| Question | Start here |
|---|---|
| Which top-level routes are declared? | [`apps/web/src/routes/Root.tsx`](../../../apps/web/src/routes/Root.tsx) |
| Which non-entity split surfaces exist? | [`componentRegistry.tsx`](../../../apps/web/src/components/app/split-layout/componentRegistry.tsx) |
| How are split URLs decoded and encoded? | [`layoutUtils.ts`](../../../apps/web/src/components/app/split-layout/layoutUtils.ts), [`layoutManager.ts`](../../../apps/web/src/components/app/split-layout/layoutManager.ts) |
| Which list views and paths exist? | [`list-views.ts`](../../../apps/web/src/lib/constants/list-views.ts) |
| Which list tabs and filters exist? | [`soup-filter-presets.ts`](../../../apps/web/src/features/next-soup/sidebar/soup-filter-presets.ts) |
| Which entity block types and aliases exist? | [`block.ts`](../../../apps/web/src/lib/core/block.ts) |
| Which block definitions are actually loaded? | [`allBlocks.ts`](../../../apps/web/src/lib/core/constant/allBlocks.ts), `apps/web/src/features/block-*/definition.ts` |
| Which settings tabs are visible? | [`settingsTabsConfig.tsx`](../../../apps/web/src/lib/core/constant/settingsTabsConfig.tsx) |
| Which features are gated? | [`featureFlags.ts`](../../../apps/web/src/lib/core/constant/featureFlags.ts) and feature-specific PostHog hooks |

Do not assume that a route name opens the matching component. In the current
implementation, single-segment workspace paths do not encode a complete
`{type}/{id}` pair and direct loads fall back to `component/inbox`. Confirm
canonical `/component/<view-id>` behavior through the split decoder before
changing route documentation.

### UI/UX and design system

| Question | Start here |
|---|---|
| Which primitives are public through `@ui`? | [`components/ui/index.ts`](../../../apps/web/src/components/ui/index.ts) |
| Which primitives exist but are not in the barrel? | [`components/ui/components`](../../../apps/web/src/components/ui/components/) |
| Which app-shell components exist? | [`components/app`](../../../apps/web/src/components/app/) |
| Which shared rendering components exist? | [`lib/core/component`](../../../apps/web/src/lib/core/component/) |
| Which composed entity patterns exist? | [`features/entity`](../../../apps/web/src/features/entity/) |
| Which property editors and displays exist? | [`features/property`](../../../apps/web/src/features/property/) |
| Which message patterns exist? | [`features/channel/Message`](../../../apps/web/src/features/channel/Message/) |
| Which feature families exist? | [`apps/web/src/features`](../../../apps/web/src/features/) |
| Where are semantic tokens defined? | [`apps/web/src/index.css`](../../../apps/web/src/index.css) |
| Where are icons and illustrations? | [`components/icon`](../../../apps/web/src/components/icon/), [`lib/design`](../../../apps/web/src/lib/design/) |
| Which live galleries can a designer inspect? | Local/dev registrations in [`componentRegistry.tsx`](../../../apps/web/src/components/app/split-layout/componentRegistry.tsx) |

Repository UI conventions are in
[`apps/web/AGENTS.md`](../../../apps/web/AGENTS.md). Prefer semantic tokens,
query-free primitives, and slot-based composition.

There is no working Storybook configuration or story set. Do not describe
Storybook as an available audit surface unless that changes in code.

### Frontend data and API boundaries

| Question | Start here |
|---|---|
| Which query/mutation owns server state? | [`apps/web/src/lib/queries`](../../../apps/web/src/lib/queries/) |
| Which client calls a service? | [`apps/web/src/lib/service-clients`](../../../apps/web/src/lib/service-clients/) |
| Which frontend host/proxy path is used? | [`servers.ts`](../../../apps/web/src/lib/core/constant/servers.ts) |
| Which OpenAPI contract generates the web client? | `service-*/openapi.json` under [`service-clients`](../../../apps/web/src/lib/service-clients/) |
| Which contracts generate the public SDK? | [`packages/sdk/specs`](../../../packages/sdk/specs/), [`packages/sdk/services.ts`](../../../packages/sdk/services.ts) |
| Which GraphQL fields and types exist? | [`static_assets/schema.graphql`](../../../static_assets/schema.graphql) |
| Which GraphQL operations does the web app use? | [`service-storage/graphql`](../../../apps/web/src/lib/service-clients/service-storage/graphql/) |

Generated contracts are stronger evidence than older service README files.

### Backend services and domain ownership

| Question | Start here |
|---|---|
| Which Rust binaries run in the local stack? | [`RUST_SERVICES`](../../../tooling/xtask/crates/xtask_local/src/local/inventory.rs) |
| Which frontend path reaches each service? | `proxyServers()` in [`servers.ts`](../../../apps/web/src/lib/core/constant/servers.ts) |
| Which domains are mounted in DSS? | [`document_storage_service/src/api/mod.rs`](../../../services/document_storage_service/src/api/mod.rs) and [`main.rs`](../../../services/document_storage_service/src/main.rs) |
| Which domains are mounted in DCS? | [`document_cognition_service/src/api/mod.rs`](../../../services/document_cognition_service/src/api/mod.rs) and [`main.rs`](../../../services/document_cognition_service/src/main.rs) |
| Which domains are mounted in auth? | [`authentication_service/src/api/mod.rs`](../../../services/authentication_service/src/api/mod.rs) |
| How are email APIs composed? | [`email_service/src/api`](../../../services/email_service/src/api/), [`crates/email/src/inbound`](../../../crates/email/src/inbound/) |
| How are notifications composed? | [`notification_service`](../../../services/notification_service/), [`crates/notification/src/inbound`](../../../crates/notification/src/inbound/) |
| How are contacts composed? | [`contacts_service`](../../../services/contacts_service/), [`crates/contacts/src/inbound`](../../../crates/contacts/src/inbound/) |
| Which background deployables exist? | [`services`](../../../services/) and infrastructure stacks under [`infra`](../../../infra/) |

Distinguish a deployable process from a domain crate mounted into another
service. For example, `search_processing_service` is a deployable indexer,
while `crates/search_service` supplies the search query API mounted in DSS.

Follow the
[hexagonal architecture rules](../../../.agents/skills/cloud-storage-hexagonal-architecture/SKILL.md)
before proposing Rust ownership changes.

### Chat, agents, tools, and MCP

| Question | Start here |
|---|---|
| Where can a user start a chat? | [`features/home`](../../../apps/web/src/features/home/), [`features/chat`](../../../apps/web/src/features/chat/), [`features/getting-started`](../../../apps/web/src/features/getting-started/) |
| What renders the chat block? | [`features/block-chat`](../../../apps/web/src/features/block-chat/) |
| What renders composer, messages, and tools? | [`lib/core/component/AI`](../../../apps/web/src/lib/core/component/AI/) |
| How does the frontend start and receive a stream? | [`service-cognition/client.ts`](../../../apps/web/src/lib/service-clients/service-cognition/client.ts), [`service-connection/stream.ts`](../../../apps/web/src/lib/service-clients/service-connection/stream.ts) |
| Where is the server stream/agent loop started? | [`document_cognition_service/src/api/stream`](../../../services/document_cognition_service/src/api/stream/) |
| Where is chat domain logic? | [`crates/chat`](../../../crates/chat/) |
| Where is agent execution? | [`crates/agent`](../../../crates/agent/) |
| Where are tools registered? | [`crates/ai_tools`](../../../crates/ai_tools/) |
| Where are frontend tool types generated? | [`service-cognition/generated/tools`](../../../apps/web/src/lib/service-clients/service-cognition/generated/tools/) |
| Where are MCP connections implemented? | [`crates/mcp_client`](../../../crates/mcp_client/), [`services/mcp_service`](../../../services/mcp_service/), [`services/mcp_auth_proxy`](../../../services/mcp_auth_proxy/) |
| Where are scheduled agents executed? | [`services/scheduled_action`](../../../services/scheduled_action/) |

Keep these concepts separate:

- in-app chat tools available to Macro's agent;
- outbound user-connected MCP servers used by Macro;
- the standalone Macro MCP server used by external agents;
- channel bots and scheduled actions that reuse agent infrastructure;
- frontend tool-call rendering versus backend tool execution.

## Recommended revision workflow

### 1. Establish scope and baseline

- Read `README.md` and only the target document.
- Inspect the current branch diff before editing.
- Record which registries, composition roots, and contracts are authoritative
  for the assignment.
- Do not treat the previous coverage counts as current without recounting them.

### 2. Divide research by non-overlapping ownership

For a broad revision, use parallel research agents:

| Workstream | Scope | Expected return |
|---|---|---|
| Frontend map | Routes, split IDs, list views/tabs, blocks, settings, flags | Exact paths and mismatches with `feature-map.md` |
| UI/UX inventory | `@ui`, app chrome, shared core, feature/block families, tokens, galleries | Added/removed components and status corrections |
| Backend map | Deployables, composition roots, domain crates, stores, queues | Ownership corrections and uncertain mounts |
| Chat/agents | Entry surfaces, composer, messages/tools, streaming, MCP, scheduled consumers | End-to-end feature-tree corrections |
| Documentation QA | Links, anchors, Mermaid, contradictions, agent usability | Actionable blockers only |

Research agents should not edit shared files. Integrate their evidence in one
place after reconciling contradictions against code.

### 3. Revise the smallest authoritative document

- Feature, route, component-tree, or flag change → `feature-map.md`.
- Service, API, store, queue, or cross-process flow → `platform-canvas.md`.
- Component, token, asset, responsive, or audit-surface change →
  `ui-ux-component-catalog.md`.
- Authority, caveat, read order, or coverage process → `README.md`.
- Update this brief only when the revision workflow or source map changes.

Avoid copying the same detailed tree into multiple documents. Add a short
summary and cross-link to the canonical section instead.

### 4. Label evidence honestly

- **Confirmed**: directly represented by runtime code or generated contract.
- **Flagged**: code exists, availability depends on environment/PostHog.
- **Dev-only**: local/development registration.
- **Legacy**: compatibility path or stale source retained in code.
- **Uncertain**: evidence exists but the runtime connection was not proven.

Never promote an inference to **Confirmed** because two README files agree.

### 5. Validate before handoff

At minimum:

- resolve every local Markdown link;
- verify every cross-document anchor;
- check balanced Markdown and Mermaid fences;
- validate Mermaid declarations and avoid custom colors/styles;
- compare `Root.tsx` routes with the route table;
- compare all `registerComponent(...)` IDs with the feature map or gallery
  catalog;
- compare `BlockRegistry` with block rows;
- compare `components/ui` and `components/app` TSX files with the UI catalog;
- compare top-level shared-core TSX files and feature directories with the
  catalog;
- compare `RUST_SERVICES` with the deployable table;
- compare settings tabs and major feature gates with the feature map;
- run independent frontend, backend, UI, and documentation reviews for a broad
  revision.

Documentation-only revisions do not require long Rust/Docker builds. If the
revision also changes implementation, run the repository-prescribed
package/service checks for those code changes.

## Known traps to re-check

1. Bare workspace route names and canonical split URLs are not equivalent.
2. `/search` and `/folders` appear in `LIST_VIEW_PATHS` but are not top-level
   `Root.tsx` routes.
3. `/files` has no registered `files` component ID.
4. `websocket-service` is a Bun stub; `connection_gateway` is the confirmed
   realtime service.
5. `scheduled-action` is not in `RUST_SERVICES`; frontend runtime and OpenAPI
   generation currently reference different local ports.
6. Calendar queries are mounted in DSS, while calendar watch/mutations live in
   email service.
7. SQS carries most search events and all backfills; Kafka carries live call
   events into search processing.
8. Contacts schema is in MacroDB even though older setup docs may mention a
   separate ContactsDB.
9. There is no working Storybook setup; use in-app galleries.
10. `.canvas` files are Macro whiteboard documents, not this Markdown
    architecture canvas.

## Required output from the revision agent

The final handoff must include:

1. Files and sections revised.
2. New, removed, corrected, and still-uncertain mappings.
3. Authoritative sources used for each significant correction.
4. Coverage counts or comparison results.
5. Link, anchor, Markdown, and Mermaid validation results.
6. Tests run for any implementation changes, or an explicit
   documentation-only statement.
7. Any follow-up that could not be proven from the repository.

Definition of done:

- another agent can start from `README.md`, choose one target document, and
  reach the implementing code without a broad search;
- routes, components, clients, deployables, domains, and stores are not
  conflated;
- uncertain and legacy behavior is visibly labeled;
- all cited paths resolve;
- no known registry entry in scope is omitted.

## Copy/paste agent prompt

```text
Revise Macro's internal platform-context documentation.

Read:
- docs/internal/platform-context/revision-agent-brief.md
- docs/internal/platform-context/README.md
- only the target document(s) required by the assignment

REVISION GOAL:
<fill in, or leave unchanged for a full-folder current-state audit>

TARGET FEATURES:
<fill in, or use all platform-context domains>

EXPECTED OUTPUT:
<fill in, or use corrected documentation plus an evidence report>

OUT OF SCOPE:
<fill in, or keep product-code changes out of scope>

Follow the source map and workflow in revision-agent-brief.md. Treat runtime
registries, composition roots, generated contracts, and migrations as more
authoritative than the documentation. Use parallel read-only research agents
for broad revisions, then reconcile evidence before editing.

Do not stop at prose review: verify local links, anchors, Mermaid, route IDs,
component IDs, block names, UI/app/shared-core component coverage, feature
directories, service inventory entries, settings tabs, and relevant feature
gates. Label unproven mappings Uncertain. Do not run long Rust/Docker builds for
a documentation-only revision.

Return the revised files plus a concise evidence and validation report.

If the placeholders above are unchanged, begin the full-folder audit
immediately and do not ask the user to restate the assignment.
```
