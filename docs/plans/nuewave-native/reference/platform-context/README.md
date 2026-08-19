# Platform context

> Internal current-state map for engineers, designers, and coding agents.
>
> Last verified: 2026-08-19
> Scope: repository behavior and source ownership, not roadmap intent
> Authority: code and generated contracts override this documentation

This folder is the shortest route from a product question to the code that
implements it. It maps the visible platform, component system, routes, service
boundaries, and major data flows without requiring a fresh repository-wide
search.

## Start here

| If the task is about... | Read first | Then consult |
|---|---|---|
| A product feature or route | [Feature map](./feature-map.md) | [Platform canvas](./platform-canvas.md) |
| A UI component, visual audit, or design-system change | [UI/UX component catalog](./ui-ux-component-catalog.md) | [Feature map](./feature-map.md) |
| Service ownership, APIs, storage, or events | [Platform canvas](./platform-canvas.md) | [Feature map](./feature-map.md) |
| Chat, agents, tools, MCP, or suggestions | [Chat and agents](./feature-map.md#chat-and-agents) | [AI service flow](./platform-canvas.md#ai-chat-and-tool-flow) |
| Split navigation, blocks, or list views | [Frontend composition](./platform-canvas.md#frontend-composition) | [Routes and view surfaces](./feature-map.md#routes-and-view-surfaces) |
| Revising or auditing this documentation | [Revision agent brief](./revision-agent-brief.md) | The target document being revised |
| Public-facing product wording | [`apps/docs`](../../../apps/docs/docs.json) | Product pages under [`apps/docs/product`](../../../apps/docs/product/) |
| Coding conventions | [`docs/STYLE_GUIDE.md`](../../STYLE_GUIDE.md) | [`apps/web/AGENTS.md`](../../../apps/web/AGENTS.md) |

Suggested agent read order:

1. Read the relevant feature row in [feature-map.md](./feature-map.md).
2. Follow only the linked component, query, client, and service paths needed.
3. Use [platform-canvas.md](./platform-canvas.md) when the change crosses a
   process, database, queue, or API boundary.
4. Use [ui-ux-component-catalog.md](./ui-ux-component-catalog.md) before adding
   a new visual primitive or interaction pattern.

Context-loading rule: load this README plus one target document by default.
Do not attach the UI catalog to backend-only work, the platform canvas to a
single-component visual change, or the full feature map when a linked feature
section is sufficient. The files deliberately cross-link so agents can expand
context only when a task crosses a boundary.

## What each file contains

| File | Purpose | Primary evidence |
|---|---|---|
| [platform-canvas.md](./platform-canvas.md) | Navigable architecture canvas: frontend shell, APIs, deployables, mounted domains, stores, queues, and critical flows | Service inventory, frontend server registry, service routers, OpenAPI/GraphQL contracts |
| [feature-map.md](./feature-map.md) | Product feature tree from route and component hierarchy through client, service, crate, and persistence ownership | Root router, split registry, block registry, list presets, feature folders |
| [ui-ux-component-catalog.md](./ui-ux-component-catalog.md) | Single-file UI/UX audit inventory covering primitives, composed systems, app chrome, feature surfaces, blocks, assets, tokens, and galleries | `@ui` barrel, component folders, feature namespaces, CSS tokens |
| [revision-agent-brief.md](./revision-agent-brief.md) | Ready-to-hand revision assignment, source lookup map, workflow, traps, validation checklist, and copy/paste prompt | This folder's authority model and current repository source paths |

## Authority and confidence

Use this order when sources disagree:

1. Runtime registries and service composition roots.
2. Generated API contracts and database migrations.
3. This folder.
4. public product documentation and older READMEs.

The highest-value runtime sources are:

| Concern | Source of truth |
|---|---|
| Top-level web routes | [`apps/web/src/routes/Root.tsx`](../../../apps/web/src/routes/Root.tsx) |
| Split component surfaces | [`componentRegistry.tsx`](../../../apps/web/src/components/app/split-layout/componentRegistry.tsx) |
| List view names and paths | [`list-views.ts`](../../../apps/web/src/lib/constants/list-views.ts) |
| List tabs and filters | [`soup-filter-presets.ts`](../../../apps/web/src/features/next-soup/sidebar/soup-filter-presets.ts) |
| Block names and aliases | [`block.ts`](../../../apps/web/src/lib/core/block.ts) |
| Loaded block definitions | [`allBlocks.ts`](../../../apps/web/src/lib/core/constant/allBlocks.ts) |
| UI primitive exports | [`components/ui/index.ts`](../../../apps/web/src/components/ui/index.ts) |
| Feature gates | [`featureFlags.ts`](../../../apps/web/src/lib/core/constant/featureFlags.ts) |
| Settings tabs | [`settingsTabsConfig.tsx`](../../../apps/web/src/lib/core/constant/settingsTabsConfig.tsx) |
| Frontend service hosts | [`servers.ts`](../../../apps/web/src/lib/core/constant/servers.ts) |
| Local Rust deployables | [`inventory.rs`](../../../tooling/xtask/crates/xtask_local/src/local/inventory.rs) |
| REST clients and schemas | [`apps/web/src/lib/service-clients`](../../../apps/web/src/lib/service-clients/) |
| SDK REST contracts | [`packages/sdk/specs`](../../../packages/sdk/specs/) |
| GraphQL contract | [`static_assets/schema.graphql`](../../../static_assets/schema.graphql) |
| MCP tool docs/schema pipeline | [`crates/ai_tools`](../../../crates/ai_tools/) and [`apps/docs/AI/mcp`](../../../apps/docs/AI/mcp/) |

Labels used throughout:

- **Confirmed**: directly represented by a runtime registry, composition root,
  generated contract, or implementation.
- **Flagged**: implementation exists, but availability depends on an
  environment or PostHog feature gate.
- **Dev-only**: registered only for local or development builds.
- **Legacy**: retained for compatibility or referenced by stale code/docs.
- **Uncertain**: the repository contains evidence, but the complete runtime
  mount or product exposure was not proven.

## Vocabulary

| Term | Meaning in this repository |
|---|---|
| Route | A Solid Router entry in `Root.tsx`; web routes are based at `/app`, while Tauri uses `/` |
| Split | One panel in the app workspace. Canonical URLs encode alternating `{type}/{id}` pairs |
| Component split | A non-entity split registered by string ID, such as `component/inbox` or `settings/account` |
| List view | A `SoupView` configuration such as inbox, mail, tasks, calls, or companies |
| Soup | The unified cross-entity list/query layer used by most workspace views |
| Block | A viewer/editor mounted for an entity type, such as `md`, `email`, `channel`, or `chat` |
| Alias | A differentiated entity that resolves to another block implementation: `task`, `snippet`, `skill`, or `csv` |
| DSS | `document_storage_service`, the main workspace API and composition root |
| DCS | `document_cognition_service`, the AI/chat API and composition root |
| Domain crate | A Rust library that owns domain logic and often contributes an inbound router to a deployable service |
| Deployable | A process, Lambda, or Worker that is independently built and run |
| Service client | The frontend HTTP/WebSocket boundary under `apps/web/src/lib/service-clients` |

## Scope boundaries

Included:

- production and flagged web surfaces;
- local/dev galleries when they are useful for design review;
- route, split, block, and settings registration;
- frontend component/query/client ownership;
- deployable and mounted Rust-domain ownership;
- primary databases, object stores, queues, streams, and external platforms;
- explicit legacy and uncertain mappings that can mislead an agent.

Not included:

- product roadmap or planned behavior;
- every REST endpoint or GraphQL field;
- Pulumi resource-by-resource topology;
- database table-by-table schema;
- public copy guidance;
- generated client internals;
- test helpers and non-rendering utility functions in the UI catalog.

Use these sources for those concerns:

- Public product docs: [`apps/docs`](../../../apps/docs/)
- API contracts: [`packages/sdk/specs`](../../../packages/sdk/specs/) and
  [`static_assets/schema.graphql`](../../../static_assets/schema.graphql)
- Storage architecture: [`docs/CLOUD_STORAGE.md`](../../CLOUD_STORAGE.md)
- Local runtime: [`docs/RUNNING_LOCALLY.md`](../../RUNNING_LOCALLY.md)
- Rust architecture rules:
  [cloud-storage hexagonal skill](../../../.agents/skills/cloud-storage-hexagonal-architecture/SKILL.md)

## Known repository caveats

- `.canvas` files in this repository are Macro whiteboard documents. The
  [platform canvas](./platform-canvas.md) is a Markdown architecture map, not a
  Macro `.canvas` payload.
- [`list-views.ts`](../../../apps/web/src/lib/constants/list-views.ts) declares
  `/search` and `/folders`, but
  [`Root.tsx`](../../../apps/web/src/routes/Root.tsx) does not declare matching
  top-level route entries. Treat `component/search` and `component/folders` as
  the confirmed split IDs.
- The single-segment workspace routes declared in `Root.tsx` do not encode a
  complete `{type}/{id}` pair. Current `decodePairs` behavior falls back to
  `component/inbox`; use canonical `/component/<view-id>` URLs for direct
  navigation. `/files` has no `files` component ID and also falls back to
  inbox. Sidebar actions can still open named views imperatively.
- The frontend still lists `websocket-service`; the Bun implementation is a
  stub. `connection_gateway` is the confirmed production realtime path.
- The Storybook commands in [`apps/web/justfile`](../../../apps/web/justfile)
  have no matching Storybook configuration or story files. Use the in-app
  galleries listed in the [component catalog](./ui-ux-component-catalog.md#debug-galleries-and-live-audit-surfaces).
- Contacts schema has moved into MacroDB, while some setup documentation still
  refers to ContactsDB separately.

## Verified coverage snapshot

The documents are manually verified, not generated and not currently enforced
by CI. On the date above, the audit compared this folder with:

| Registry/source | Entries checked | Unrecorded |
|---|---:|---:|
| `registerComponent(...)` IDs | 52 | 0 |
| `Root.tsx` route paths | 24 | 0 |
| `BlockRegistry` names | 17 | 0 |
| Non-test `components/ui` TSX files | 31 | 0 |
| `components/app` TSX files | 42 | 0 |
| Top-level shared core TSX files | 53 | 0 |
| Top-level feature directories | 44 | 0 |
| Local service inventory entries | 14 | 0 |
| Settings tabs | 12 | 0 |
| Local Markdown links | all five files | 0 broken |

The snapshot is evidence of the stated verification, not a freshness
guarantee. New code wins immediately when it differs.

## Refresh checklist

Update this folder when any of the following changes:

1. Compare `ROUTES`, `registerComponent(...)`, `LIST_VIEWS`,
   `BlockRegistry`, and `SETTINGS_TAB_GROUPS` to the feature map.
2. Compare `components/ui/index.ts` and new rendering folders under
   `components/app`, `lib/core/component`, and `features` to the UI catalog.
3. Compare `RUST_SERVICES` and `proxyServers()` to the deployable table.
4. Compare DSS, DCS, auth, email, notification, and contacts router composition
   to the mounted-domain table.
5. Check `packages/sdk/specs`, `static_assets/schema.graphql`, and generated MCP
   schemas for contract changes.
6. Re-check every item labeled **Uncertain** or **Legacy**.
7. Update the `Last verified` date in the README and three current-state maps;
   the revision brief is workflow guidance and is not date-stamped.

Documentation-only validation does not require Rust/Docker builds. Verify links,
registry coverage, Mermaid syntax, and Markdown structure.
