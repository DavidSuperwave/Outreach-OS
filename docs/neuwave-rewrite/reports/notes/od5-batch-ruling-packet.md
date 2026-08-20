# OD-5 batch ruling packet — the 57 unruled ledger rows

Prepared 2026-08-20 for the owner's batch ruling session (OD-5 mode ruling,
2026-08-20: option (a) — owner rules all rows personally, in batches).

> **SESSION RECORD — RULED 2026-08-20.** The batch ruling session was held
> in-session on 2026-08-20, as an owner walkthrough conducted via the lead
> agent. All 52 plain rows in Batches 1–5 were **accepted exactly as this
> packet recommends**, and all nine Structural items were ruled (choices
> recorded in the tally below). **One override:** Batch 4 row 9
> (streaming/completions, ledger:65) — the packet's sub-recommendation to
> kill the `/chat/completions` OpenAI passthrough was overridden by a
> dedicated ruling in the same session: the owner chose
> **keep-with-governance** (option (a) of entry 2 in
> `reports/notes/od2-exception-rulings-draft.md`); the passthrough survives
> with an owner, spend attribution, and a model allow-list, and the
> "ungoverned" wording is retired. The rest of that row (durable streams
> dissolve into kernel sessions; `/structured-completion` becomes an RPC
> method) stands as recommended. **Transcription to the canonical ledger on
> `research/nuewave-longtail` remains pending** — this worktree cannot write
> that branch; the filled tally below is the transcription source.

**Canonical ledger:** `docs/plans/nuewave-native/merge/merge-ledger.md` @
`research/nuewave-longtail` `13c2847` (read-only; rulings recorded here are
transcribed back to the ledger by a scribe afterwards). All `ledger:NNN`
references below are line numbers in that file at that pin.

## Count verification (done fresh against the pin)

- **57 rows carry the ◐ glyph** (mechanical `grep -c '^| ◐'` = 57; line list
  re-derived and enumerated below — matches the prior count exactly).
- Of those 57, **one is glyph-inconsistent**: `ledger:117`
  (getting-started/onboarding/paywall FE) already carries a dated verdict
  ("Parked to end, 2026-08-19") but was never flipped to ✔ — it needs only
  transcription, not a decision.
- **One more glyph inconsistency outside the ◐ set**: `ledger:87`
  (Coding-agent capability, future) sits at ☐ yet carries a dated ruling
  ("Marked future-only, 2026-08-19, ruling A3"). Folded into OD-5 per the
  roadmap ("only David reconciles it"). Included in the Structural section.
- **Packet total: 58 items** = 56 rows needing a genuine verdict + 2
  glyph reconciliations, plus 3 *missing-row* creations (DLP, frecency,
  activity vocabulary — OD-19/OD-21) that have no line number yet.

**Default in force (Q19, 2026-08-19):** any row not explicitly ruled is
KEEP — faithful recreation. Every "keep" recommendation below therefore
costs the owner one word; only deviations from the default need thought.

**Verdict vocabulary used:** `keep` (faithful recreation) ·
`keep-adapted` (semantics kept, substrate/shape changes per the row's
proposal) · `defer` (rule later, at a named gate) · `kill` (dated kill).

**How batches are ordered:** by the earliest build-graph node
(05-implementation-build-graph) the batch unblocks. Wave 2 spine first,
then wave 4a first-track connectivity, then everything downstream.
Structurally significant rows (OD-18/19/20/21 + analytics-proxy,
channel-bots, coding-agent glyph) are pulled out of the batches into the
final section — **discuss, don't rubber-stamp**.

---

## Batch 1 — Data-model shape rows (unblocks N1/N2 spine + schema-reference adoption, Wave 2)

Nine rows from ledger §7. Context that makes these fast: OD-1 is ruled
(2026-08-20, no live data — Branch A "schemas over, data doesn't"), so every
one of these is a decision about whether the old *shape* informs the new
D1/DO design, never about porting tables or data.

1. **Identity, teams, membership tables** (ledger:181) — the old user /
   team / membership table shapes. *Finding:* part of the one physical
   Postgres DB (198→194 live tables, count corrected in 01 §2.9 I2).
   *Proposal:* none recorded. *Node:* N1 (wave 2). *Recommend:*
   **keep-adapted** — reference shapes only; OD-16 already ruled the kernel
   auth flow is adopted directly, so these inform, not dictate, the identity spine.
2. **Documents + versions + annotations tables** (ledger:182) — how
   documents, their versions, and PDF annotations were stored. *Finding:*
   15 tables incl. sha-keyed `DocumentInstance`, branching, docx BOM parts.
   *Proposal:* none recorded (documents row carries it). *Node:* N7 (wave
   4a). *Recommend:* **keep-adapted** — adopt as design reference for the
   registry/DO model ruled in 1a; actual split decided with OD-18.
3. **Projects (folders) tables** (ledger:183) — the self-referential
   folder-tree table. *Finding:* `Project.parentId` is the Project=Folder
   invariant (already ✔) in schema form. *Node:* N7 (wave 4a).
   *Recommend:* **keep-adapted** — reference for the D1/1a tree + index design.
4. **Sharing / ACL tables** (ledger:184) — who-can-see-what storage.
   *Finding:* cross-ref SEC-1/2/3 holes; share-permission semantics already
   ✔ ruled "preserved with holes fixed" (Q20). *Node:* N2 (wave 2, on the
   critical path). *Recommend:* **keep-adapted** — shapes as reference; the
   receipts subsystem (ADR-004) is the real design, and it is already bound by Q20.
5. **AI chat, insights, projections tables** (ledger:185) — storage behind
   AI chat and the cached AI outputs. *Finding:* chat is ✔ ruled (kernel
   sessions); projections' fate rides OD-28. *Node:* N10/N14 area (wave 4a).
   *Recommend:* **keep-adapted** — reference only; the durable-stream tables
   dissolve into kernel sessions (see Batch 4, streaming row).
6. **Properties (EAV) tables** (ledger:186) — the custom-property storage.
   *Finding:* pattern already ✔ ruled 2a (semantics kept, storage replaced).
   *Node:* N8 (wave 4a). *Recommend:* **keep-adapted** — the ruling exists;
   this row just extends it to the concrete table shapes.
7. **GitHub, bots, webhooks, import, reminders, activity tables**
   (ledger:189) — storage for the integration/long-tail domains.
   *Finding:* the webhook delivery table's `UNIQUE(webhook_id, event_id)`
   is exactly the ruled D3 idempotency shape. *Node:* N9/N10/N17 (wave
   4a–4c). *Recommend:* **keep-adapted** — reference shapes; each domain
   row (Batch 4 / Structural) carries the real decision.
8. **Notifications tables** (ledger:192) — 11 tables behind the
   notification system. *Finding:* count verified exact (01 §2.4).
   *Node:* N18 (wave 4c). *Recommend:* **defer** — follows the
   notification_service verdict (Batch 5, row 10 / OD-3); ruling the tables
   before the service inverts the dependency.
9. **Already-D1 schemas** (ledger:205) — sync-service peer-map and
   ai-editing edit_traces, the two schemas already on Cloudflare D1.
   *Finding:* both belong to services in the ✔ ruled lift set.
   *Node:* N7 (wave 4a, lift set). *Recommend:* **keep** — they are already
   on the target substrate; they travel with the lift, zero extra work.

---

## Batch 2 — Frontend surfaces: routes & splits (unblocks N5 shell skeleton, Wave 2)

Eleven rows from ledger §4. Context: OD-11 is ruled (2026-08-20) — ALL
screens rebuilt from scratch to 1:1 Neuwave visual parity on the custom
React shell. That ruling makes most of these one-word keeps; the scope
question per row is only "does this surface exist in Outreach-OS at all".

1. **`home`** (ledger:104) — the chat-first landing view with composer.
   *Finding:* hosts the Home-recommendations surface fed by ai_projections.
   *Node:* N5 (wave 2 skeleton). *Recommend:* **keep** — landing view is
   core shell; whether recommendations populate it rides OD-28, not this row.
2. **`inbox`** (ledger:105) — the unified inbox list. *Finding:* a Soup
   view (engine ✔ ruled). *Node:* N5/N4. *Recommend:* **keep** — a preset
   of the already-ruled list engine; near-free.
3. **`tasks` + `task-compose`** (ledger:106) — the task list and its
   composer, the Work-tab heart. *Finding:* subject of the vertical slice
   (N6); task modeling awaits OD-7. *Node:* N5→N6 (wave 2–3, critical
   path). *Recommend:* **keep** — the slice literally cannot exist without it.
4. **`agents`** (ledger:107) — the agents/automations list view.
   *Finding:* surfaces scheduled_action runs ("automation = scheduled
   chat"). *Node:* N5, content wave 4a. *Recommend:* **keep** — the natural
   home of the P1 agent-centerpiece surface.
5. **`documents` / `files` / `folders`** (ledger:109) — the file and
   folder list views. *Node:* N5/N7. *Recommend:* **keep** — core surface
   over an all-but-certain keep domain.
6. **`search`** (ledger:112) — the search results list. *Node:* N5/N16.
   *Recommend:* **keep** — UI keeps regardless of which search substrate
   wins (OD-27/OD-15).
7. **`settings`** (ledger:114) — 12 active tabs, 3 groups
   (Account/Billing/Appearance/Team/Tags/CRM/Connections/MCP/Bots/Admin…).
   *Node:* N5. *Recommend:* **keep-adapted** — keep the frame and the
   non-parked tabs; the Billing tab is inside the parked business chrome,
   and brand renames ride OD-24.
8. **Command menu / launcher** (ledger:115) — the Cmd-K command surface.
   *Finding:* the 387-row command/hotkey ledger implements through it; it
   was a stated reason for the OD-11 custom-shell ruling. *Node:* N5 (wave
   2). *Recommend:* **keep** — load-bearing for the entire parity bar.
9. **`import-linear` + integrations** (ledger:118) — the Linear-import and
   MCP-setup screens. *Finding:* the old integration catalog is a
   hardcoded frontend constant (connectivity audit). *Node:* N10 (wave 4a
   first track). *Recommend:* **keep-adapted** — the surface folds into the
   P1 connectivity catalog rather than being recreated as a hardcoded page.
10. **Entity layer + property system + sharing + favorites (FE infra)**
    (ledger:119) — the cross-cutting UI plumbing behind blocks and lists.
    *Node:* N5/N2 (wave 2). *Recommend:* **keep** — it is the client half
    of receipts + properties, both already ruled at pattern level.
11. **Dev-only splits (24)** (ledger:120) — debug/playground pages.
    *Finding:* row already annotated "default: not recreated". *Node:*
    none. *Recommend:* **kill** (dated) — make the default explicit so the
    ledger closes clean; nothing downstream references them.

---

## Batch 3 — Block types (unblocks N5 block registry → N7 viewers, Wave 2→4a)

Nine rows from ledger §5. A "block" is the viewer/editor a split opens for
an entity type. Aliases matter: `task`/`snippet`/`skill` are md-block
flavors; `csv` is a code-block flavor.

1. **`md` (+ task/snippet/skill aliases)** (ledger:131) — the Markdown
   editor block, and via aliases the task/snippet/skill editors.
   *Finding:* Task-as-md-flavor sits directly on OD-7. *Node:* N5/N6/N7.
   *Recommend:* **keep** — core editor; alias structure revisited only if
   OD-7 makes task first-class (recommended there as option (c)).
2. **`chat` (AI chat)** (ledger:132) — the AI-chat conversation block.
   *Finding:* chat domain ✔ ruled "kernel runs, old UX on top". *Node:*
   N5/N10. *Recommend:* **keep** — it IS the "old UX on top".
3. **`project` (folder)** (ledger:136) — the folder-contents block.
   *Node:* N7. *Recommend:* **keep** — pairs with the projects row (Batch 5).
4. **`code` (+ csv)** (ledger:137) — code and CSV file viewer. *Node:* N7.
   *Recommend:* **keep** — small; 2 command rows.
5. **`pdf` / `image` / `video`** (ledger:138) — media viewers. *Finding:*
   PDF carries the annotation stack that the documents audit says moves
   with the documents build. *Node:* N7 (+N15 for previews). *Recommend:*
   **keep** — viewers keep; the annotation build lands per the OD-18 split.
6. **`canvas`** (ledger:139) — the canvas/whiteboard block. *Finding:* 37
   command rows ride it (the largest single block command group). *Node:*
   N7 (wave 4a). *Recommend:* **keep** — heaviest block, but parity-bar
   scope under OD-11 either way.
7. **`automation`** (ledger:140) — the block that shows a scheduled
   automation. *Node:* N10. *Recommend:* **keep-adapted** — becomes the
   surface for "(saved prompt + schedule) → kernel agent session" per the
   scheduled_action row (Batch 4).
8. **`pr` (GitHub PR)** (ledger:141) — the GitHub pull-request block.
   *Finding:* rendered from foreign_entity rows that only GitHub writes.
   *Node:* N9/N10. *Recommend:* **defer to the github ruling** (Batch 4
   row 3) — keeps iff github keeps; on its own it has no data source.
9. **`unknown` (fallback)** (ledger:143) — the fallback block for
   unrenderable entities. *Node:* N5. *Recommend:* **keep** — tiny safety
   net; a registry needs a fallback arm regardless.

---

## Batch 4 — Connectivity, integrations, AI plumbing (unblocks N10, the ruled P1 first track of Wave 4a; feeds N9/N11)

Eleven rows. Context: OD-4 ruled (2026-08-20) — connectivity is the P1
centerpiece because the sandboxed agent cannot currently ingest external
data; N10 starts the moment the slice freezes contracts. These rows ARE
N10's scope authority.

1. **foreign_entity** (ledger:44) — a live *reference* to a record that
   stays in an external system (vs `import`, which copies). *Finding:*
   exactly one producer in practice (GitHub PR sync); one public endpoint;
   under 1a it is the cleanest registry-only entity. *Proposal:* rule with
   `github`; the copy-in vs live-reference question (connectivity audit
   §D5) decides whether the concept survives. *Node:* N10/N9 (wave 4a).
   *Recommend:* **keep-adapted** — keep the live-reference concept as the
   registry-entity form the P1 layer needs; near-zero standalone cost.
2. **webhook (outbound)** (ledger:45) — Macro-as-webhook-provider: teams
   register URLs and get signed event deliveries. *Finding:* ledger label
   "ingestion" was wrong; delivery policy verified exact (5 attempts,
   30/60/120/300s, HMAC `x-macro-*`, per-event idempotency = the ruled D3
   shape already). *Proposal:* CRUD via R3 RPC, delivery as per-webhook DO
   drain; blocked by the SSRF ruling (OD-6). *Node:* N10 (wave 4a).
   *Recommend:* **keep** — the guarantees are already in the ruled idiom;
   only the egress guard needs OD-6.
3. **github** (ledger:47) — the GitHub integration: PRs appear as
   first-class items, with review/check notifications and task links.
   *Finding:* only real bidirectional sync at the pin; the sole
   *team-scoped* external credential (App installations); produces 7 of
   the platform's 19 notification types. *Proposal:* gatekeeper-github +
   C2 `/hooks/github/*` + foreign_entity mirror; team-credential model is
   OD-29. *Node:* N10/N9 (wave 4a). *Recommend:* **keep-adapted** — it is
   the reference implementation of the connectivity centerpiece pattern;
   third-biggest crate, so scope it per the OD-29 outcome.
4. **memory** (ledger:59) — a ~1–3k-word AI-written profile of each user,
   prepended to AI prompts, regenerated daily by a whole-workspace agent
   sweep. *Finding:* one endpoint, 24h stale-while-revalidate (verified);
   one of the most expensive recurring AI costs in the old system.
   *Proposal:* per-user DO field + D4 alarm + read-only kernel session;
   rule together with ai_projections as one "materialized agent output"
   primitive. *Node:* N10 (wave 4a). *Recommend:* **keep-adapted** — keep
   the primitive, but the daily whole-workspace sweep needs the explicit
   cost sign-off tracked as OD-28.
5. **import** (ledger:60) — copy-in of external data (Linear/Notion/Slack)
   via a staged, discardable candidate list gathered by a cheap agent.
   *Finding:* named by the connectivity audit as the strongest existing
   analogue of the ruled P1 centerpiece; 3 hardcoded MCP sources with
   fixed target types (verified). *Proposal:* ledger→DO state, gather →
   kernel session with locked staging tool, sources → gatekeeper
   connections; the pattern is the candidate Instantly-ingestion
   mechanism. *Node:* N10 (wave 4a first track). *Recommend:* **keep-adapted**
   — this is P1-adjacent scope, not tail scope; the staging-ledger pattern
   is exactly what governed agent ingress needs.
6. **ai_usage** (ledger:62) — token/cost metering per AI feature.
   *Finding:* the 10-value `AiFeature` enum is a complete inventory of
   every AI-spend surface (verified exact); cost observability, never a
   billing gate. *Proposal:* Cloudflare AI Gateway absorbs collection; the
   feature tag is the only real carry-over. *Node:* N10 (wave 4a).
   *Recommend:* **keep-adapted** — keep the feature dimension stamped at
   the model-routing layer; let AI Gateway do the rest.
7. **ai_projections** (ledger:63) — registered prompt + schema,
   materialized per user/team on a 6h/1d/3d cadence; powers Home
   recommendations. *Finding:* same primitive as memory; weakest lease
   tier in the platform (insert-as-lock) which the D4 ruling already
   abolishes. *Proposal:* per-target DO alarms; kernel structured output.
   *Node:* N10 (wave 4a). *Recommend:* **keep-adapted, contingent on OD-28**
   — the primitive merges with memory; the Home-recommendations *surface*
   is the open product question, ruled at OD-28, not here.
8. **mcp_client** (ledger:64) — the old in-house MCP client (per-user
   servers, encrypted creds, 3-strategy OAuth, searchable tool catalog).
   *Proposal:* replaced by `gatekeeper-mcp` (kernel already covers most of
   it). *Node:* N10. *Recommend:* **kill (superseded)** — with a rider to
   harvest the OAuth-strategy and tool-catalog semantics into the
   gatekeeper design before deletion; recreating it would duplicate the kernel.
9. **streaming/completions (native)** (ledger:65) — the AI streaming
   transport (resumable streams, cross-instance stop) plus a structured-
   completion endpoint and a bare OpenAI passthrough. *Finding:* the
   durable-stream half is the ledger's strongest "kernel already has this"
   case — it dissolves into DO-hosted sessions; `/chat/completions` is a
   verified 47-line hardcoded proxy, called the one clear kill candidate.
   *Node:* N10/C1 (wave 4a). *Recommend:* **keep-adapted** — streams
   dissolve into kernel sessions, `/structured-completion` becomes an RPC
   method, and **kill the OpenAI passthrough** — noting OD-2 currently
   lists "ungoverned OpenAI proxy" as a claimed deliberate exception, so
   this sub-verdict must be reconciled with OD-2 in the same sitting.
10. **scheduled_action** (ledger:81) — "automations": a saved prompt +
    cron schedule that runs an agent chat. *Finding:* `ActionKind` has
    exactly one variant (`Agent`, verified) — automation IS a scheduled
    chat; its polling dispatcher is the canonical case the D4 ruling
    abolishes. *Proposal:* not a service — (saved prompt + schedule) →
    kernel agent session via per-action DO alarms; harvest the cron+IANA
    timezone semantics verbatim. *Node:* N10 (wave 4a). *Recommend:*
    **keep-adapted** — cheapest honest recreation in the batch.
11. **mcp_service + mcp_auth_proxy** (ledger:83) — Macro exposed *as* an
    MCP server to external agents, plus an OAuth broker that existed only
    because FusionAuth lacked DCR. *Finding:* the proxy's raison d'être is
    verified substrate-motivated and FusionAuth is dead. *Node:* N10 (wave
    4a). *Recommend:* **split verdict — keep-adapted / kill**: keep the
    MCP-server surface via gatekeeper-mcp (it is one of the four OD-2
    exceptions); kill the auth proxy, which dissolves with the ruled auth rebuild.

---

## Batch 5 — Core entity domains, per-user state, files & media, wave-4c consumers (unblocks N7/N8 fringe, N14, N15, N16, N18, N19)

Twelve rows, ordered by the node they block. The first three sit beside the
mega-rows ruled in the Structural section but are separable and plain.

1. **projects (=folders)** (ledger:34) — the folder tree: create, move,
   share, soft-delete/restore/purge, and async folder upload with
   progress. *Finding:* self-referential parent edge = the ✔
   Project=Folder invariant; the async upload pipeline (pending row →
   extractor → status pushes) is the real work and maps cleanly onto the
   ruled D3/D4 + C1 shapes. *Node:* N7 (wave 4a, head of the post-slice
   critical path). *Recommend:* **keep** — invariant already ruled;
   medium effort, no open questions.
2. **properties** (ledger:39) — custom fields (definitions, options,
   tags) on any entity, with bulk grid/kanban editing; the largest domain
   crate. *Finding:* storage direction already ✔ ruled (2a); the blocking
   rider is entity-type canonicalization — TASK/THREAD exist in the
   property enum but not in `EntityType` (verified exact). *Node:* N8
   (wave 4a); rider blocks N2. *Recommend:* **keep** — with the rider that
   the verdict is executable only after OD-7 reports; preserve the bulk
   RPC shapes (a per-item loop is not faithful).
3. **favorites** (ledger:42) — a user's personal ordered pin list of any
   entity, capped at 500. *Finding:* smallest genuine row in the ledger;
   fractional-index ordering ports unchanged; a revoked entity stays
   listed until removed (read-side access gap) — interacts with the ✔
   "SEC holes fixed, not recreated" ruling. *Node:* N4/N17. *Recommend:*
   **keep** — with the gap fixed per Q20, as a design stance not a copy.
4. **static_file_service** (ledger:77) — generic blob storage for
   everything that is not a document (uploads, attachments, presigned
   URLs). *Finding:* metadata lives in an **unharvested DynamoDB table**
   (verified) — a blind spot until the shape is reconstructed; the
   pending→ready lifecycle is the same machine as document ingestion.
   *Proposal:* R2 + Workers; reconstruct the Dynamo shape from client code
   (OD-1 Branch A removed the need for production access). *Node:* N14
   (wave 4b). *Recommend:* **keep-adapted** — R2-native, one shared
   content-state machine with documents.
5. **unfurl_service** (ledger:78) — link-preview cards (fetch a URL, read
   its OpenGraph tags), plus the CRM's fallback domain resolver.
   *Finding:* the hardening is the substance; its DNS-resolve-then-reject
   SSRF guard cannot be expressed in Workers — one shared ruling (OD-6)
   covers unfurl/image-proxy/webhooks/connectors. *Node:* N14 (wave 4b).
   *Recommend:* **keep-adapted** — small Worker behind the OD-6 safe-fetch
   mechanism; decide caching deliberately (none proven in the old service).
6. **image_proxy_service** (ledger:79) — despite the name, not a resizer:
   a streaming pass-through that launders remote images (CORS/hotlink/
   referrer), mostly for inline email images. *Finding:* Cloudflare
   Images/Resizing is strictly more capable and also absorbs the separate
   image_optimizer Lambda; the row may be droppable once the mailbox is
   rebuilt. *Node:* N14 (wave 4b). *Recommend:* **defer to N14 design
   time, kill-leaning** — decide "is remote-image laundering still
   needed" with the mailbox build in view; nothing needs porting either way.
7. **convert_service** (ledger:82) — DOCX→PDF conversion via an embedded
   LibreOffice/Collabora stack. *Finding:* no Workers-native successor
   exists (verified pin, fonts EULA and all); it is the producer of the
   `ConvertedPdf` content location, i.e. half the documents content model.
   *Proposal:* Cloudflare Container running the harvested stack (OD-8
   recommendation), external API, or drop DOCX rendering. *Node:* N15
   (wave 4c; ruled together with OD-8/OD-18). *Recommend:* **keep-adapted
   via container (OD-8)** — dropping DOCX would amputate the documents row
   that is otherwise a keep.
8. **search_service** (ledger:38) — the query side of search: 7 entity
   types, one unified + one simple endpoint, results enriched after the
   index returns ids. *Finding:* "seven-source search" wording corrected —
   it is a 7-entity-type coverage contract over one index, not seven
   providers. *Proposal:* thin RPC surface; the substrate is the real
   decision and is the same slot as the ruled materialized-index layer
   (OD-27: one projection substrate or two; OD-15 election checkpoint).
   *Node:* N16 (wave 4c; substrate co-designed at N4, wave 2).
   *Recommend:* **keep** — the coverage contract; substrate ruled at OD-27/OD-15, not here.
9. **search_processing_service** (ledger:80) — the indexing side: one
   consumer per entity type off the event bus, plus backfill/delete/
   extract endpoints. *Finding:* bus contract corrected to **12 product
   topics, not 14** (`macro.com` and `macro.activity_events` are not
   topics — 01 §2.5 E3); activity flows via the fact log. *Proposal:*
   Queues consumers, idempotent per D3; backfill as DO-with-alarm.
   *Node:* N16 (wave 4c). *Recommend:* **keep** — rule in the same breath
   as search_service; they are one system.
10. **notification_service** (ledger:75) — "mention someone and they find
    out": 19 notification types, in-app + mobile push + email digests,
    per-type preferences. *Finding:* the largest unruled capability; the
    provisional "Drop" is stale and dangerous — every producer of the 19
    types is now ruled keep, so dropping relocates the work into channels
    rather than removing it; mobile push has no kernel analogue and no
    in-repo native client. *Proposal:* OD-3 recommends keep in-app WS +
    email digests now, defer push until a native client exists (pairs
    with OD-9). *Node:* N18 (wave 4c; emission contracts needed by N9/N11
    in 4a/4b). *Recommend:* **keep-adapted per OD-3 branch (b)** — in-app
    + digests now, push deferred with a dated note.
11. **onboarding (backend)** (ledger:61) — two endpoints and one row;
    reading the state drives the first-run flow and auto-starts imports.
    *Finding:* inside the Q19-parked business chrome; the dual gate
    (`tutorialComplete` vs `user_onboarding`) is a bug not to recreate.
    *Node:* N19 (wave 5, owner-spec'd). *Recommend:* **defer (parked-prepare,
    per the standing Q19 park)** — record it as parked with the two
    harvestable mechanics noted (read-triggers-work; connector-first flow).
12. **getting-started / onboarding(setup) / paywall (frontend)**
    (ledger:117) — the first-run and billing screens. *Finding:* the row
    ALREADY carries "Parked to end (2026-08-19)" in its verdict column;
    only the ◐ glyph was never flipped. *Node:* N19 (wave 5).
    *Recommend:* **transcribe existing verdict, flip glyph to ✔** — no new
    decision needed unless the owner wants to supersede the park.

---

## Structural — discuss, don't rubber-stamp

The rows below either decide the shape of the biggest build (OD-18), create
rows that don't exist (OD-19/21), sign off a cross-cutting mapping (OD-20),
or fix record-keeping with product implications. Fuller options given.

### S1. `documents` mega-row split (ledger:33; OD-18) — blocks N7's spec, head of the post-slice critical path

The polymorphic core entity: 25 endpoints, 5 creation flavors, 15 tables,
8 events, 5 content locations, plus the threads/comments/PDF-annotation
stack AND the task system riding inside it. Largest single row in the
ledger; the audit (documents-audit §G) offers three splits:

- **G1 — three rows: core / annotations / tasks.** Cleanest scope lines;
  lets tasks be ruled against OD-7's outcome and annotations land with the
  PDF viewer build.
- **G2 — one row with sub-scope.** One verdict, least ledger churn, but
  N7's domain spec must then carry the internal split anyway.
- **G3 — split tasks only.** Middle path; annotations stay inside core.

*Packet recommendation:* **G1**, because (a) the task system's fate is
already entangled with OD-7 and the slice, so it deserves its own verdict
line, and (b) the audit itself notes annotations are the same build as the
PDF block, which is severable. Whichever split wins, the underlying
disposition for all parts is **keep** per Q19. Rule together with OD-8
(converter shares the content-location model).

### S2. DSS-native chrome mega-row split (ledger:50; OD-18) — blocks N2 (entity-access is inside it)

Seven names in one row, and one of them — **entity_access** — is the
platform's authorization core (62 files, 14 typed extractors, 13 per-type
query modules, 68% tests = the only executable spec of the ruled
share-permission invariant). The rest (annotations, saved-views, pins,
history, activity, recents) are genuinely small. Audit split options:

- **N1 — four-way split** (entity-access / activity / per-user state /
  annotations-with-documents). Most precise; matches where the pieces
  actually land in the build graph (N2, N17, User-DO, N7).
- **N2 — split out entity-access only.** Minimum viable: the one piece
  that blocks wave 2 gets its own verdict.
- **N3 — one row with sub-scope.** Cheapest paper, worst scope authority.

*Packet recommendation:* **N1 four-way**, with entity-access ruled **keep
(recreate semantics as the receipts subsystem, SEC-1/2/3 fixed)** in the
same sitting — it is a prerequisite for every other kept domain and the
build graph already treats it as N2 content. The other three parts are
plain keeps.

### S3. Lambda/batch families row (ledger:90; OD-18, feeds OD-19/20) — decides where 20 background jobs land

Exactly 20 Lambda handlers + 1 ECS worker in 7 families (census verified).
The audit's finding: most dissolve rather than port — trigger/handler
pairs collapse into DOs with alarms; the two 1-minute polls are the
canonical "no ported dispatchers" case; ingestion becomes R2
events + Queues. Only the Gmail watch re-arm is inherently periodic.
Options:

- **(a) Adopt the audit's per-family dissolution and re-attach ~7 rows to
  their owning domains** (audit §G1) — each domain's spec then owns its
  background jobs. *Recommended.*
- **(b) Keep one collective row with a single "dissolve per D3/D4"
  verdict** — fast, but N7/N13/N14/N15/N17/N20 specs must each rediscover
  their share.

Two members need individual attention regardless: the **DLP handler**
(→ S4) and the **ffmpeg call-preview handler** (rides OD-8 with the
converter).

### S4. DLP retention/deletion job — MISSING ROW (OD-19)

A daily job that scans and **deletes user content on policy**. It has no
ledger row, so the Q19 default cannot apply — nothing to default. A
destructive job silently absent from scope is the worst kind of gap.
Options:

- **(a) Create the row; keep with a re-specified policy surface** —
  a deletion job over the new stores, designed with ADR-005
  storage-ownership rules and N17's append-only activity design.
  *Recommended by OD-19.*
- **(b) Create the row; dated kill** — legitimate if the policy product is
  dead, but must be said explicitly, because retention/decommission gates
  cite it.

### S5. Redis successor mapping (OD-20) — cross-cutting, no single row

22 crates/services use Redis (stream transport, backfill counters,
cancellation pub/sub, sha-delete work set) and no ruling names a CF
successor. There is deliberately no single successor. Options:

- **(a) Ratify the mapping table inside ADR-005** — stream transport →
  Queues/kernel sessions; cancellation pub/sub → DO alarms/hibernation
  signals; counters & work-sets → DO storage or D1. Owner signs the
  mapping once, not each use. *Recommended by OD-20.*
- **(b) Rule each use per domain** — 22 small decisions scattered across
  wave 4; invites drift.

### S6. Frecency + activity-events vocabulary — MISSING ROWS (OD-21, now blocking N17)

Two load-bearing engines with no ledger row of their own:

- **frecency** — the real recents/quick-access ranking: score =
  0.7×frequency + 0.3×recency, 0.1/hour decay, last 10 events (verified
  exact); consumed by five domains.
- **activity vocabulary** — a closed 10-action event vocabulary with
  UUIDv5 ids where renaming an action is a storage migration (verified).

04-TARGET §12 already designs User-DO frecency lanes and the D1 activity
log against these exact constants, and ADR-005's vocabulary registration
needs the rows to exist. Options:

- **(a) Create both rows; keep-faithful with the verified constants frozen
  as parity fixtures.** *Recommended by OD-21 — the constants are already
  exact; freezing them is free.*
- **(b) Create rows but allow re-tuning** — forfeits deterministic parity
  testing for N17 with no identified benefit.

### S7. bots + channel_bots (ledger:46) — two halves, and a contract-reference decision (G-019)

Non-human principals in channels: bot CRUD, scoped tokens
(`mbot_<prefix>_<secret>`, verified), an unauthenticated channel webhook
poster, and mention-triggered in-channel agents (the only system bot is
Macro AI: post "thinking", run agent, edit answer). Also the second owner
type on outbound webhooks. The two halves want different rulings:

- **(a) Bot identity + tokens** — an auth-model question: a bot is a
  principal with scoped credentials, which the kernel expresses as
  gatekeeper/agent identity. Gated on the ruled auth rebuild (N1).
- **(b) Mention-triggered agents** — a kernel-session shape (mention →
  session → post/edit), i.e. C1 events over the ruled single agent
  runtime, not a new runtime.

**Folded-in disposition items:** the two `services/bots/*` workers
(anthropic-status-bot, stripe-payment-bot) are **already Cloudflare
Workers** and are the only working reference for the
`x-macro-bot-token`/`x-macro-bot-scope` webhook contract. They have no
ledger row. Options: (i) add disposition rows, keep both as living
contract references (near-zero cost, N9 cites the contract); (ii) harvest
the contract into the N9 spec and retire them. *Packet recommendation:*
**keep-adapted for the row (both halves), (i) for the workers** — cheap
insurance for a contract N9 must reproduce.

### S8. analytics-proxy (ledger:88) — a stance, not a port (interacts OD-30)

Already a Cloudflare Worker (verified): same-origin PostHog proxy +
Datadog OTLP forwarding with server-side key injection. Two things demand
an explicit decision rather than inheritance:

- It **renames the PostHog session-replay recorder script to evade
  privacy filter lists** (verified in source) — a privacy/product stance
  the owner should own or reject explicitly.
- Whether Outreach-OS keeps PostHog+Datadog at all vs the kernel's
  analytics position is OD-30, not this row.

Options: (a) **keep-adapted** — keep the Worker pattern (first-party
origin, server-side secrets), decide the recorder-rename explicitly,
sinks per OD-30; (b) **defer wholly to OD-30**; (c) kill and adopt
kernel-native telemetry. *Packet recommendation:* **(a) with the
recorder-rename called out for an explicit yes/no** — effort is
near-zero either way.

### S9. Coding-agent glyph reconciliation (ledger:86–87; route ruling A3)

Record-keeping with a scope implication. Facts (all verified): the old
`coding-agent-worker` directory is empty at the pin (one lockfile, no
source, never a Cloudflare Worker); ruling A3 (2026-08-19) dropped it from
the lift set and re-pointed future intent at ledger:87, which says
"future-only, not pilot scope" — but that row still carries the ☐
(unresearched) glyph despite holding both research and a dated ruling.
Options: (a) **confirm A3 as-is; flip ledger:87 to ✔** (future-only, no
pilot scope) — *recommended, pure transcription*; (b) reopen and schedule
a coding-agent capability into the pilot — a genuine scope addition that
would need its own node, on the kernel's own agent runtime per A3's note.

---

## Tally — FILLED (owner rulings, in-session 2026-08-20; scribe transcribes to the canonical ledger with this date)

Verdicts: K = keep · KA = keep-adapted · D = defer (name the gate) · X = kill.
Pre-filled entries are transcriptions of existing dated rulings, not new decisions.
All verdicts below carry the same date: **Ruled 2026-08-20** (owner, in-session
walkthrough via lead agent). Every plain row is the packet recommendation
accepted as written; the single override is marked on ledger:65.

### Batch 1 — data model

| Ledger | Row | Verdict |
|---|---|---|
| 181 | Identity, teams, membership tables | KA — reference shapes only. Ruled 2026-08-20 |
| 182 | Documents + versions + annotations tables | KA — design reference; split per OD-18/G1. Ruled 2026-08-20 |
| 183 | Projects (folders) tables | KA — reference for D1/1a tree. Ruled 2026-08-20 |
| 184 | Sharing / ACL tables | KA — reference; receipts subsystem (ADR-004) is the design. Ruled 2026-08-20 |
| 185 | AI chat, insights, projections tables | KA — reference only; streams dissolve into kernel sessions. Ruled 2026-08-20 |
| 186 | Properties (EAV) tables | KA — extends the 2a ruling to concrete shapes. Ruled 2026-08-20 |
| 189 | GitHub/bots/webhooks/import/reminders/activity tables | KA — reference shapes; domain rows carry the real decisions. Ruled 2026-08-20 |
| 192 | Notifications tables | D — follows notification_service verdict (ledger:75 / OD-3). Ruled 2026-08-20 |
| 205 | Already-D1 schemas | K — travel with the lift set. Ruled 2026-08-20 |

### Batch 2 — frontend surfaces

| Ledger | Row | Verdict |
|---|---|---|
| 104 | `home` | K — recommendations population rides OD-28. Ruled 2026-08-20 |
| 105 | `inbox` | K. Ruled 2026-08-20 |
| 106 | `tasks` + `task-compose` | K — vertical-slice subject. Ruled 2026-08-20 |
| 107 | `agents` | K. Ruled 2026-08-20 |
| 109 | `documents` / `files` / `folders` | K. Ruled 2026-08-20 |
| 112 | `search` split | K — substrate ruled at OD-27/OD-15. Ruled 2026-08-20 |
| 114 | `settings` (12 tabs) | KA — frame + non-parked tabs; Billing parked; renames per OD-24. Ruled 2026-08-20 |
| 115 | Command menu / launcher | K. Ruled 2026-08-20 |
| 118 | `import-linear` + integrations | KA — folds into the P1 connectivity catalog. Ruled 2026-08-20 |
| 119 | Entity layer + property + sharing + favorites (FE) | K. Ruled 2026-08-20 |
| 120 | Dev-only splits (24) | X — dated kill; default made explicit. Ruled 2026-08-20 |

### Batch 3 — blocks

| Ledger | Row | Verdict |
|---|---|---|
| 131 | `md` (+ task/snippet/skill) | K — aliases stand per the OD-7 facet ruling. Ruled 2026-08-20 |
| 132 | `chat` | K. Ruled 2026-08-20 |
| 136 | `project` | K. Ruled 2026-08-20 |
| 137 | `code` (+ csv) | K. Ruled 2026-08-20 |
| 138 | `pdf` / `image` / `video` | K — annotation build lands per the OD-18/G1 split. Ruled 2026-08-20 |
| 139 | `canvas` | K. Ruled 2026-08-20 |
| 140 | `automation` | KA — surface for scheduled kernel agent sessions. Ruled 2026-08-20 |
| 141 | `pr` | D — rides the github ruling (ledger:47, KA), so keeps with it. Ruled 2026-08-20 |
| 143 | `unknown` | K. Ruled 2026-08-20 |

### Batch 4 — connectivity & AI

| Ledger | Row | Verdict |
|---|---|---|
| 44 | foreign_entity | KA — live-reference concept as registry-entity form. Ruled 2026-08-20 |
| 45 | webhook (outbound) | K — egress guard gated on OD-6. Ruled 2026-08-20 |
| 47 | github | KA — reference connectivity pattern; scope per OD-29. Ruled 2026-08-20 |
| 59 | memory | KA — primitive kept; sweep cost sign-off remains OD-28. Ruled 2026-08-20 |
| 60 | import | KA — P1-adjacent; staging-ledger pattern kept. Ruled 2026-08-20 |
| 62 | ai_usage | KA — feature dimension kept; AI Gateway absorbs collection. Ruled 2026-08-20 |
| 63 | ai_projections | KA, contingent on OD-28 for the Home-recommendations surface. Ruled 2026-08-20 |
| 64 | mcp_client | X — superseded by gatekeeper-mcp; rider: harvest OAuth-strategy + tool-catalog semantics before deletion. Ruled 2026-08-20 |
| 65 | streaming/completions | KA — streams dissolve into kernel sessions; `/structured-completion` becomes RPC. **OVERRIDE on the sub-verdict:** `/chat/completions` passthrough is **KEPT with governance** per OD-2 entry 2 option (a) — owner, spend attribution, model allow-list; "ungoverned" wording retired. Packet's kill sub-recommendation not adopted. Ruled 2026-08-20 |
| 81 | scheduled_action | KA — (saved prompt + schedule) → kernel agent session; cron+IANA semantics harvested verbatim. Ruled 2026-08-20 |
| 83 | mcp_service / mcp_auth_proxy | Split: mcp_service **KA** via gatekeeper-mcp (OD-2 exception 1); mcp_auth_proxy **X** — dissolves with the auth rebuild. Ruled 2026-08-20 |

### Batch 5 — core entities, files & media, wave-4c consumers

| Ledger | Row | Verdict |
|---|---|---|
| 34 | projects (=folders) | K. Ruled 2026-08-20 |
| 39 | properties | K — bulk RPC shapes preserved; entity-type rider satisfied by the OD-7 ruling. Ruled 2026-08-20 |
| 42 | favorites | K — read-side access gap fixed per Q20. Ruled 2026-08-20 |
| 77 | static_file_service | KA — R2-native; shared content-state machine with documents. Ruled 2026-08-20 |
| 78 | unfurl_service | KA — small Worker behind the OD-6 safe-fetch mechanism. Ruled 2026-08-20 |
| 79 | image_proxy_service | D — to N14 design time, kill-leaning; decided with the mailbox build. Ruled 2026-08-20 |
| 82 | convert_service | KA — via container per OD-8/ADR-012 (OD-2 exception 4). Ruled 2026-08-20 |
| 38 | search_service | K — 7-entity-type coverage contract (OD-2 exception 3); substrate at OD-27/OD-15. Ruled 2026-08-20 |
| 80 | search_processing_service | K — one system with ledger:38. Ruled 2026-08-20 |
| 75 | notification_service (+ push channel) | KA per OD-3 branch (b) — in-app + digests now, push deferred (dated). Ruled 2026-08-20 |
| 61 | onboarding (backend) | D — parked-prepare per the standing Q19 park; harvestable mechanics noted. Ruled 2026-08-20 |
| 117 | getting-started / setup / paywall (FE) | Parked 2026-08-19 verdict confirmed; glyph flipped to ✔ (pure transcription). Ruled 2026-08-20 |

### Structural

| Item | Row(s) | Decision needed | Verdict / choice |
|---|---|---|---|
| S1 | 33 documents | split G1 / G2 / G3 + verdict | **G1** — three rows (core / annotations / tasks); all parts KEEP; tasks per the OD-7 facet ruling. Ruled 2026-08-20 |
| S2 | 50 DSS-native | split N1 / N2 / N3 + entity-access verdict | **N1** four-way split; entity_access **KEEP** — semantics recreated as the receipts subsystem with SEC-1/2/3 fixed; other three parts plain keeps. Ruled 2026-08-20 |
| S3 | 90 Lambda families | dissolution mapping (a)/(b) | **(a)** — dissolve per family into owning domains; DLP and ffmpeg members handled by their own rulings (S4, OD-8). Ruled 2026-08-20 |
| S4 | (new row) DLP | create + keep-respecified / kill | **(b)** — row created, then **KILL, on record, dated**: no automated content-retention deletion job in the new product; compliance/decommission gates cite this explicit dated verdict, not an absence. Ruled 2026-08-20 |
| S5 | (no row) Redis mapping | ratify ADR-005 mapping table y/n | **(a) yes** — mapping table ratified once inside ADR-005; owner signs the map, not each use. Ruled 2026-08-20 |
| S6 | (new rows) frecency + activity vocab | create + freeze constants y/n | **(a) yes** — both rows created; keep-faithful with verified constants (0.7/0.3 weights, 0.1/hour decay, last-10 events; 10-action UUIDv5 vocabulary) frozen as parity fixtures. Ruled 2026-08-20 |
| S7 | 46 bots + channel_bots | row verdict + worker disposition (i)/(ii) | **KA both halves** (bot principals as gatekeeper/agent identity; mention-triggered agents as kernel sessions); workers: **(i)** — disposition rows added, both KEPT as living contract references for `x-macro-bot-token`/`x-macro-bot-scope`. Ruled 2026-08-20 |
| S8 | 88 analytics-proxy | stance + recorder-rename explicit y/n | **Keep both as-is** — the first-party proxy pattern AND the session-recorder rename that evades privacy filter lists. Put to the owner as a distinct yes/no; the owner explicitly chose to keep the disguise and owns this stance. Substantially resolves OD-30 in favor of keeping the PostHog+Datadog proxy pattern. Ruled 2026-08-20 |
| S9 | 87 coding-agent (future) | confirm A3, flip ☐→✔ | **(a)** — ruling A3 confirmed as-is; ledger:87 flips to ✔ future-only / not pilot scope (pure transcription). Ruled 2026-08-20 |

---

*Coverage check: 52 plain rows across Batches 1–5 (9+11+9+11+12) + 5 ◐
structural rows (33, 46, 50, 88, 90) = the full 57-row ◐ set; + ledger:87
glyph fix + 3 missing-row creations (S4, S6×2) + 1 no-row mapping sign-off
(S5). Nothing in the ◐ set is unlisted.*
