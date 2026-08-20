# 06 — Owner decisions needed (merged queue)

Date: 2026-08-20. WP-030 part C deliverable. This file is the **registry of record** for
owner-decision IDs.

Sources merged and deduplicated:

- `reports/notes/wp000-owner-decisions.md` (11 items, WP-000 ground truth)
- `reports/notes/wp010-owner-decisions.md` (OD-1..OD-10, WP-010 gap review — IDs kept verbatim)
- `reports/notes/wp020-rpc-coverage.md` (4 needs-review RPC rows + 3 queued items)
- `reports/notes/wp020-hotkey-coverage.md` (5 flagged items)
- `reports/notes/wp030-adr-owner-decisions.md` + `reports/adrs/ADR-001..014` (WP-030 sibling
  drafts; they coined OD-11..OD-15, kept verbatim)
- `reports/notes/wp030-arch-owner-decisions.md` + `reports/04-target-architecture-decisions.md`
  (WP-030 part A; coined OD-301..OD-306, merged below — see alias map)
- `reports/05-implementation-build-graph.md` (build-graph blockers)

Numbering rule: OD-1..10 from WP-010 and OD-11..15 from the ADR drafts are preserved unchanged;
new items surfaced only in WP-000/WP-020 notes are assigned OD-16..OD-26; genuinely-new items
from the WP-030 architecture pass (which used a collision-free OD-301..306 block) are assigned
OD-27..OD-30. **Alias map for 04's references:** OD-301 → **OD-12(b)** (duplicate, folded);
OD-302 → **OD-27**; OD-303 → **OD-21** (re-raise, folded); OD-304 → **OD-28**; OD-305 →
**OD-29**; OD-306 → **OD-30**. If any future note coins an ID ≥ OD-16 or a new OD-3xx, this
file wins and the reference is renumbered to the next free ID here.

Evidence pins: Neuwave @ `9f7a26b`; canonical ledger `docs/plans/nuewave-native/merge/merge-ledger.md`
on `research/nuewave-longtail` @ `13c2847` (read via `git show` only); kernel `cloudflare-os` @
`bf7f762`; package/worktree @ `dec12f2`.

## Urgency-ordered index (what blocks the critical path first)

Critical path (05 §4): N0 → N1 (auth) → N2 (entity core) → N3 → N4 → N6 slice → N7 documents →
converter/search → cutover. Rank = the earliest graph node the decision blocks.

| Rank | ID | Decision | Blocks first | Needed by |
|---|---|---|---|---|
| 1 | OD-7 | **RULED 2026-08-20** (post-audit) — task stays a document facet per Macro's own treatment; thread = EmailThread, already first-class. ADR-003/04 update pending | N2, ADR-003, the recommended slice | ~~Wave 2 start~~ resolved |
| 2 | OD-5 | **RULED 2026-08-20** — batch session held in-session (walkthrough via lead agent): all 57 ◐ rows + structural items ruled; packet recommendations accepted with one override (`/chat/completions` kept-with-governance per OD-2 entry 2); canonical-ledger transcription pending | Build-graph/domain-spec freeze (every ⧖verdict node) | ~~Wave 2~~ resolved |
| 3 | OD-1 | **RULED 2026-08-20** — no live data; Branch A (N20a) selected; schemas kept as reference only | Release-gate wording, slice migration fixture, ADR migration branches | ~~Wave 2~~ resolved |
| 4 | OD-16 | **RULED 2026-08-20** — kernel auth flow adopted directly (deferral B closed; no legacy mounts, follows OD-1 fresh start) | N1 identity spine | ~~Wave 2~~ resolved |
| 5 | OD-11 | **RULED 2026-08-20** — fully custom UI/UX: ALL screens rebuilt from scratch to 1:1 Neuwave parity, including surfaces the stock Cloudflare OS shell provides (its component set is far thinner than Macro/Neuwave's); stock kernel screens may be rendered only as a transitional measure, subject to the same parity bar | N5 shell skeleton, ADR-001 acceptance | ~~Wave 2~~ resolved (ADR-001 embeds reclassified transitional) |
| 6 | OD-4 | **RULED 2026-08-20** — P1 centerpiece confirmed, with clarified intent: connectivity exists because the Cloudflare sandboxed agent cannot currently ingest data from MCPs or external APIs; the deliverable is governed data ingress for the agent. First track post-slice | Wave-4 ordering; slice-rider choice | ~~Before WP-040~~ resolved |
| 7 | OD-27 | **RULED 2026-08-20** — one D1 projection plane, two schema families | ADR-006/ADR-007 finalization | ~~Wave 2~~ resolved |
| 8 | OD-2 | **RULED 2026-08-20** — all four exception entries signed: entries 1/3/4 confirmed as drafted (MCP server via gatekeeper-mcp with auth-proxy carve-out; seven-entity-type search, wording corrected; converter as isolated container per ADR-012); entry 2 = keep-with-governance for the `/chat/completions` proxy | Search/converter/MCP/proxy ADR acceptance | ~~Sign-off pending~~ resolved (ledger transcription pending) |
| 9 | OD-10 | **RULED 2026-08-20** — zero-kernel-patch budget bound; exceptions need ADR + owner sign-off | Governance of every wrapper-vs-kernel choice | ~~Immediately~~ resolved |
| 10 | OD-18 | **RULED 2026-08-20** — documents split G1 (core/annotations/tasks, all keep); DSS-native split N1 (four-way, entity_access KEEP as the receipts subsystem); Lambda families dissolve per family into owning domains | N7 domain spec | ~~Wave 4a entry~~ resolved |
| 11 | OD-13 | Sync two-plane posture ratification | N7 (documents/collaboration) | Wave 4a entry |
| 12 | OD-29 | Team-scoped external credentials model [= OD-305] | N10 connectivity centerpiece; §15 GitHub scope | Wave 4a entry |
| 13 | OD-6 | One safe-fetch/SSRF ruling | N14; N10 webhook egress | Wave 4a/4b entry |
| 14 | OD-3 | **RULED 2026-08-20** — keep notifications: in-app + email digests, mobile push deferred until a native client exists | N18; notification emission design in N9/N11 | ~~Wave 4b/4c~~ resolved (ledger transcription pending) |
| 15 | OD-8 | Converter + ffmpeg substrate | N15; N13 call previews; N7 content-location model | Wave 4a/4c entry |
| 16 | OD-12 | RPC-freeze details (renames; 4 needs-review rows; facet-contract scope) [absorbs OD-301] | Compatibility-freeze acceptance (ADR-002) | Freeze acceptance |
| 17 | OD-9 | **RULED 2026-08-20** — web-only pilot ("we only need webapp"); desktop/mobile revisited post-launch; push channel stays deferred per OD-3 | Push channel, deep-link ADR, platform matrix | ~~Wave 4b/4c~~ resolved |
| 18 | OD-17 | **RULED 2026-08-20** — collapses with OD-9: serve nothing at `/.well-known` for the pilot (deferral C3 closed) | Deep links; interacts OD-9 | ~~Wave 4b/4c~~ resolved |
| 19 | OD-21 | **RULED 2026-08-20** — both rows created; keep-faithful with the verified constants frozen as parity fixtures [was re-raised by OD-303] | N17; 04 §12 fixtures; ADR-005 vocabulary registration | ~~Wave 4c entry~~ resolved |
| 20 | OD-28 | **RULED 2026-08-20** — memory/profile primitive kept, but refresh on user activity instead of the daily whole-workspace sweep; Home recommendations ride the same on-activity cadence [= OD-304] | N10/§14 wrapper scope; AI-cost budget | ~~Wave 4a scope freeze~~ resolved |
| 21 | OD-19 | **RULED 2026-08-20** — row created, then KILLED on record, dated: no automated content-retention deletion job in the new product | N17/retention design; decommission gates | ~~Wave 4c/5~~ resolved |
| 22 | OD-15 | Search substrate election checkpoint | N16 final substrate | Wave 4c |
| 23 | OD-20 | **RULED 2026-08-20** — the successor mapping table is ratified once, inside ADR-005; owner signs the map, not each use | Cross-cutting infra design check | ~~Wave 4a+~~ resolved |
| 24 | OD-22 | DynamoDB static-file table harvest (production access) | N14 parity; N20b profiling | With OD-1 |
| 25 | OD-14 | Password-hash / user-import contract | N20b identity mapping (only if OD-1 = Branch B) | With OD-1 |
| 26 | OD-30 | **RULED 2026-08-20** — keep the PostHog+Datadog first-party proxy pattern as-is, including the session-recorder rename (stance explicitly owned) [= OD-306] | Observability sinks; flag-gated commands | ~~Wave 2/3~~ resolved |
| 27 | OD-24 | **RULED 2026-08-20** — rename ALL Macro-branded strings, themes, and storage keys to Outreach OS equivalents from day one | First shipped UI strings | ~~Wave 2/3~~ resolved |
| 28 | OD-23 | Command-ledger flagged dispositions (4 small items) | N5 polish | Wave 3/4 |
| 29 | OD-25 | Merge-branch pin drift resolution | Hygiene | Any time |
| 30 | OD-26 | Node 24 enforcement (`engines`/`.nvmrc`) | Hygiene | Any time |

---

## Existing entries kept verbatim (summaries + graph impact)

Full text for OD-1..OD-10 lives in `reports/notes/wp010-owner-decisions.md`; it is not duplicated
here. Per-item summary, recommendation, and build-graph impact:

### OD-1 — Confirm the no-live-data premise; re-scope or activate migration **[graph-blocking]**

- **Evidence:** ruling 8, `merge/README.md:52-56` @ `13c2847` ("the four Postgres databases hold
  no live data") vs package `08-DATA-MIGRATION-AND-CUTOVER.md` / `10-DELIVERY-PLAN.md` wave-4
  item 10 / `12-DEFINITION-OF-DONE.md` (mandate live-data migration). CON-1, G-013.
- **Affected ruling:** ruling 8 (2026-08-19).
- **Impact:** largest single scope swing; the build graph models it as the conditional branch
  N20a (schema adoption + seed) vs N20b (full 7-stage pipeline) — 05 §3 N20. Also decides the
  content of every domain's "migration/rollback proof" release gate and the slice's migration
  fixture; ADR drafts are written two-branched on it.
- **Options/recommendation:** (a) confirm no live data anywhere (Postgres, DynamoDB ×2, Redis,
  S3, OpenSearch, FusionAuth) → N20a, close G-013; (b) enumerate stores that do hold data →
  scope N20b to exactly those; (c) keep 08 as-is (rejects ruling 8 — say so explicitly).
  **Recommend (a)-or-(b) answered as a production fact, not a default**; the ledger's own text
  supports (a).
- **Blocked:** N20 branch selection; OD-22 access; OD-14 relevance; migration release-gate
  wording in waves 2+.
- **RULING (owner, in-session, 2026-08-20): option (a) — start fresh; no live data migrates.**
  The owner confirmed there is no Postgres data with actual documents to migrate. The old
  Postgres schemas may be brought over **as design reference only** when shaping the new
  Cloudflare storage (D1 is SQLite, not Postgres — no direct import path exists anyway; this is
  exactly ADR-013 Branch A "schemas over, data doesn't"). Consequences: N20a selected, N20b and
  the 7-stage pipeline are dead; OD-14 (password-hash import) and OD-22 (DynamoDB harvest for
  migration profiling) lose their Branch-B relevance; G-013 closes; every domain's migration
  release gate becomes "schema-reference documented + seed fixtures load", per ADR-013 Branch A.
  **Propagation pending:** this ruling still needs a dated entry in the canonical ledger on
  `research/nuewave-longtail` (this registry cannot write to that branch).

### OD-2 — Record the four "deliberate exceptions" in the ledger, with governance docs

- **Evidence:** `01-AUTHORITY-AND-SCOPE.md` §Deliberate exceptions vs empty verdicts at ledger
  rows :83 (mcp), :65 (completions proxy — research calls it "the one clear kill candidate"),
  :38 (search), :82 (converter). CON-2.
- **Impact:** ADR-007 (search) and the converter/MCP/proxy ADRs harden these into architecture;
  a future agent reading only the branches would reverse two of them with apparent authority.
- **Recommendation:** owner (or scribe with sign-off) writes four dated verdicts + the
  boundary/threat/observability/rollback docs 01-AUTHORITY itself demands; correct
  "seven-source" to "seven-entity-type" wording while doing so.
- **Blocked:** acceptance of ADR-007; converter-boundary and MCP/model-layer ADRs; N10/N15/N16.
- **MODE RULING (owner, in-session, 2026-08-20):** the owner directed that the four dated
  verdict entries be drafted for sign-off. Draft lives at
  `reports/notes/od2-exception-rulings-draft.md`; entries do NOT count as rulings until the
  owner approves them. NOTE the flagged tension: the OD-5 packet's streaming row recommends
  killing the `/chat/completions` OpenAI passthrough, colliding with exception (2) — the proxy
  entry in the draft must present this collision for explicit resolution in the batch session.
- **RULING (owner, in-session, 2026-08-20): all four exception entries signed.** Entries 1, 3,
  and 4 are confirmed as drafted: (1) the Macro-as-MCP-server surface stays, recreated via
  `gatekeeper-mcp`, with the `mcp_auth_proxy` broker carved out of the exception (dissolves with
  the auth rebuild); (3) seven-entity-type search stays at full breadth, wording corrected from
  "seven-source"; (4) the self-hosted converter stays as an isolated container boundary per
  ADR-012. The contested entry 2 is ruled **option (a) — keep-with-governance**: the
  `/chat/completions` passthrough survives with a named owner, spend attribution, and a model
  allow-list; "ungoverned" wording retired ("governed OpenAI-compatible proxy"). This overrides
  the OD-5 packet's kill sub-recommendation for that endpoint. Ruling record:
  `reports/notes/od2-exception-rulings-draft.md` (now RULED-IN-SESSION). Governance-doc
  checklists remain open obligations; canonical-ledger transcription pending (this registry
  cannot write `research/nuewave-longtail`).

### OD-3 — Explicit verdict for notification_service (+ mobile push) **[hard gate for N18]**

- **Evidence:** ledger:75 provisional "Drop", verdict empty; 19 types / 3 egress / 11 tables
  verified exact (01 §2.4); every producer ruled keep; push has no kernel analogue (D7) and no
  in-repo native client (K6). ADR-009 is structured so this OD selects a branch.
- **Recommendation:** option (b) of wp010 — keep in-app WS + email digests now, defer push until
  a native client exists (pairs with OD-9); revisit push at N19/N21 time.
- **Blocked:** N18 build; notification-emission contracts in N9/N11; ADR-009 branch selection.
- **RULING (owner, in-session, 2026-08-20): keep notifications — in-app (kernel session push)
  + email digests; mobile push deferred until a native client exists.** The stale provisional
  "Drop" at ledger:75 is overruled; ADR-009's recommended branch is selected. The ledger row
  still needs its dated verdict transcribed in the OD-5 batch session (it is in the packet).

### OD-4 — Connectivity build priority: P1 centerpiece vs 8th-of-10 **[sequencing]**

- **Evidence:** ledger:74 "Build as the P1 outreach centerpiece (2026-08-19)" vs
  `10-DELIVERY-PLAN.md` wave-4 ordering (8th of 10, self-labelled proposal). CON-4.
- **Impact/recommendation:** the build graph (05 §4) presents both orderings and recommends the
  ledger-priority ordering — N10 as the **first track of wave 4a**, immediately post-slice
  (dated ruling outranks proposal; N10 needs only N1+N2+contract freeze, so pulling it forward
  is nearly free and feeds N11 mailbox). Owner confirms the ruling still stands under full
  absorption, or supersedes it with a date.
- **Blocked:** wave-4 ordering freeze; the slice-rider choice (05 §6 point 4).
- **RULING (owner, in-session, 2026-08-20): P1 centerpiece confirmed, intent clarified.** The
  reason connectivity is the centerpiece: the Cloudflare sandboxed agent cannot currently bring
  in data from MCPs or external APIs — connectivity IS the agent's governed data-ingress
  capability, not merely one domain among ten. N10 runs as the first track of wave 4a
  (immediately post-slice), and its scope statement must lead with "sandboxed agent can read
  external data through governed connectors (Gatekeepers/MCP)" — consistent with the root
  AGENTS.md bound (Instantly **reads**; no send/activate without a separate owner instruction).

### OD-5 — Close the ledger: 57 unruled rows, closure mode **[graph-blocking]**

- **Evidence:** ledger @ `13c2847`: 101 rows = 43 ✔ / 57 ◐ empty-verdict / 1 ☐ glyph
  inconsistency; Q19 default-KEEP header; roadmap "Next: David rules the researched rows in
  batches". CON-5, PB-1.
- **Impact:** every ⧖verdict node in the build graph (N1, N2, N4, N5, N7, N8, N9, N10, N14,
  N15, N16, N18) has scope resting on the default; structural choices the default cannot make
  route to OD-18/19/20/21.
- **Sub-items folded in here (rule in the same sitting):** disposition rows for analytics-proxy
  and the two channel-bot workers (G-019 — the bots are the only working reference for the
  `x-macro-bot-token` contract); the coding-agent row glyph reconciliation (ledger line 87 vs
  ruling A3 — roadmap says only David reconciles it).
- **Options/recommendation:** (a) batch ruling session; (b) delegate named structural choices to
  ADRs with sign-off checkpoints; (c) bless "Q19 default + audit proposals" as buildable
  authority, recorded. **Recommend (c) for plain rows + (a) for the rows named in OD-18/19/21**
  — that unblocks the graph freeze fastest while keeping structural calls with the owner.
- **Blocked:** build-graph freeze; domain-spec authoring for unruled rows; ADR acceptance.
- **MODE RULING (owner, in-session, 2026-08-20): option (a) — batch ruling session.** The owner
  will rule all 57 rows personally, in batches. A ruling packet (rows grouped by domain, each
  with evidence pointer and a one-line recommendation) is being prepared under
  `reports/notes/od5-batch-ruling-packet.md` to make the session fast. Rows named in
  OD-18/19/20/21 are included in the packet as their own structural section.
- **RULING (owner, in-session, 2026-08-20): the batch session was held and the ledger is
  closed.** All 52 plain rows in Batches 1–5 were accepted exactly as the packet recommends
  (including the 24 dev-only-split kills, the mcp_client kill with harvest rider, and the
  mcp_service keep-adapted / mcp_auth_proxy kill split), and all nine structural items were
  ruled — filled tally in `reports/notes/od5-batch-ruling-packet.md`. **One override:** the
  streaming row's `/chat/completions` sub-verdict is keep-with-governance per OD-2 entry 2, not
  kill. The folded sub-items are resolved: analytics-proxy ruled at S8 (see OD-30); the two
  channel-bot workers get disposition rows and are kept as living contract references for
  `x-macro-bot-token`/`x-macro-bot-scope` (S7 option i); the coding-agent glyph is reconciled —
  A3 confirmed, ledger:87 flips to ✔ future-only (S9). Transcription of all verdicts to the
  canonical ledger on `research/nuewave-longtail` remains pending (this registry cannot write
  that branch).

### OD-6 — One safe-fetch/SSRF ruling for Workers

- **Evidence:** DNS-resolution defence in 3 services (unfurl `http_safety/mod.rs:91-115`;
  webhook `http_validator.rs`; image-proxy `resolver.rs` — resolver-level, the parity bar);
  Workers cannot resolve-then-decide. ADR-010/ADR-011 carry the design proposal.
- **Recommendation:** ratify ADR-011's mechanism (shared safe-fetch egress, resolver-level or
  better) as wp010 option (a); explicitly decide whether image-proxy survives post-mailbox
  (ledger:79 notes it may be droppable).
- **Blocked:** N14 entirely; N10 webhook delivery; connector endpoint validation; ADR-010/011
  acceptance.

### OD-7 — Entity-type canonicalization: are `task` and `thread` entities? **[#1 urgency]**

- **Evidence:** `EntityType` = 16 variants (`crates/model-entity/src/lib.rs:34`) vs
  `property_entity_type` = 10 values incl. TASK/THREAD which have no EntityType variant
  (migrations `20251128000000:3-4` etc.); D2/2a rider: "settle entity-type canonicalization
  first". Verified exact, 01 §2.9 I6.
- **Impact:** blocks ADR-003 finalization, the properties domain (largest crate), and the
  recommended vertical slice, whose subject (Task) sits directly on this decision (05 §6).
- **Options/recommendation:** (a) task+thread first-class entity types; (b) both stay facets +
  property system gains a facet dimension; (c) hybrid — task first-class, thread stays a
  document/channel facet. **Recommend (c)**: One-Task-Database is already a ✔ ruling (Q20) and
  task participates in lists/kanban/properties as a peer, while thread's access model is
  derivative of its parent (thread extractor + thread_access module exist, but no property or
  Soup-tab surface at the pin).
- **Blocked:** N2/ADR-003 acceptance; N8 spec; WP-040 slice start.
- **RULING (owner, in-session, 2026-08-20): follow Macro's actual treatment — task remains a
  document facet (document + `sub_type='task'` marker + TASK property bundle), NOT a first-class
  entity type.** Ruled after the dedicated audit
  (`reports/notes/od7-task-treatment-audit.md`) showed the old code treats tasks as documents at
  every boundary ("Tasks are documents at API boundaries"), with access receipts minted as
  Document. THREAD is resolved as an alias of the already-first-class EmailThread — no new
  entity type there either. Consequences: the standing hybrid recommendation (option c) is
  superseded; ADR-003 and 04 §tasks must be updated to facet modeling; the properties system
  carries the facet dimension as in the source; the recommended vertical slice keeps Task as its
  subject (now exercising document + facet + properties, which is *more* representative, not
  less). N2 and the slice are unblocked.

### OD-8 — Converter and media substrate (LibreOffice + ffmpeg)

- **Evidence:** `services/convert_service` embeds LibreOffice (`rs-libreoffice-bindings` @
  `056a40d`, Collabora core-co-25.04, fonts EULA in `docker/Dockerfile.convert_service`);
  ffmpeg only in `services/call_recording_preview_handler`. Verified G1/G2.
- **Recommendation:** converter — Cloudflare Container running the harvested stack (honors the
  OD-2 exception; wp010 option (a)) with capacity/sandbox/observability docs; ffmpeg — same
  container pattern or Cloudflare Media Transformations, decided with the converter, and ruled
  **together with the documents content-location model** (`ConvertedPdf`), i.e. alongside OD-18.
- **Blocked:** N15; N13 call-preview subfeature; N7 content-location design; converter ADR.

### OD-9 — Native/desktop/mobile scope

- **Evidence:** Tauri desktop shell in-repo (`apps/web/tauri/src-tauri/tauri.conf.json`);
  iOS/Android sources absent while native surfaces exist (SNS ios/android/iosvoip + CallKit in
  `crates/notification/src/outbound/mobile.rs`; `tauri.localhost` auth origins). K6/G-011.
- **Recommendation:** minimum ask now — rule mobile apps out of pilot scope (web + Tauri-desktop
  only), revisit after cutover; this collapses the push question in OD-3 to option (b) and
  bounds ADR-001's platform matrix.
- **Blocked:** OD-3 push branch; deep-link/route design; deferral C3 (OD-17).
- **RULING (owner, in-session, 2026-08-20): web-only pilot** ("we only need webapp").
  Desktop and mobile are out of pilot scope and revisited post-launch; the push channel stays
  deferred per the OD-3 ruling. The in-repo Tauri desktop shell remains harvestable later but is
  out of pilot scope. ADR-001's platform matrix is bounded to web; deferral C3 resolves with
  OD-17.

### OD-10 — Kernel-change budget binding from wave 0

- **Evidence:** kernel pinned `bf7f762` (2026-08-05); planning branches already carry
  `patches/sup-536-openrouter-kernel.patch`; budget text (04-TARGET) activates only at wave 2.
  Kernel-gap register (05 §5) finds **zero mandatory kernel changes**; SUP-536-style model-layer
  routing is the single budgeted candidate (KG-11).
- **Recommendation:** wp010 option (a) — budget binding from wave 0; SUP-536 requires a
  retroactive ADR if it lands in the new repo.
- **Blocked:** nothing hard; governs every wrapper-vs-kernel choice from day one.
- **RULING (owner, in-session, 2026-08-20): option (a) — zero-patch budget bound from wave 0.**
  The kernel submodule stays pinned and unmodified; any exception requires its own ADR with an
  upgrade-cost estimate and the owner's sign-off. SUP-536 model routing needs a retroactive ADR
  if it is ever to land.

### OD-11 — Shell strategy sign-off (coined by ADR-001)

- **Evidence:** `reports/adrs/ADR-001-shell-strategy.md` (Proposed): custom React shell speaking
  the frozen `/api` contract, with a proposed embed list of stock surfaces (admin config,
  approval queue, gadget iframes).
- **Impact:** N5 cannot pass skeleton stage without the strategy fixed; 04-TARGET explicitly
  requires this as an ADR-recorded owner decision.
- **Recommendation:** approve custom shell + the proposed embed list (matches the owner's stated
  end goal; the 387-row command ledger and split engine are unreproducible in the stock shell).
- **Blocked:** N5; ADR-001 and ADR-013(command-registry topic) acceptance; visual-parity gates.
- **RULING (owner, in-session, 2026-08-20):** rebuild and rewrite ALL UI/UX screens from
  scratch. The 1:1 parity standard (against the Neuwave/Rust screens as visual reference)
  applies to every surface — including ones the stock Cloudflare OS shell already provides,
  because the Macro/Neuwave component library is far richer than what was built for Cloudflare
  OS. Stock kernel screens (admin config, approval queue, etc.) may be *rendered in*
  transitionally, but they are subject to the same parity bar and must ultimately be rebuilt
  with the new component library. ADR-001's embed list is hereby reclassified from permanent to
  transitional.

### OD-12 — RPC-freeze details (coined by ADR-002; absorbs 4 needs-review rows + queued items)

- **Also absorbs:** **OD-301** from `notes/wp030-arch-owner-decisions.md` (duplicate of
  sub-decision (b) below; its recommended default — keep-but-disabled via ServerConfig —
  matches this entry's recommendation; 04 §1/§18.5 references resolve here).
- **Evidence:** `reports/notes/wp020-rpc-coverage.md` §Dispositions + §Other owner decisions;
  `reports/02-rpc-compatibility-ledger.csv` rows flagged `needs-review`.
- **Sub-decisions:** (a) pin current method names vs adopt `TODO(multi-gadget)` renames
  (`openGadget`→`openWorkspace` etc.) before the freeze — **recommend pin current names**
  (ledger note's own recommendation); (b) dispositions for `authenticateFromCfAccess`
  (Access-mode auth in scope?) and the Cloudflare limits/usage trio (`getCloudflareUsage`,
  `listCloudflareAccounts`, `selectCloudflareAccount`) — **recommend keep-but-disabled pending
  deployment posture**; (c) scope ruling for per-vendor gatekeeper session contracts
  (19 packages) and per-gadget `connectToGadget` facets — **recommend explicit out-of-scope for
  the 182-row freeze, inventoried per domain as consumed** (05 §5 KG-3).
- **Blocked:** compatibility-freeze acceptance (ADR-002); contract-test scope.

### OD-13 — Sync/collaboration two-plane posture (coined by ADR-008)

- **Evidence:** `reports/adrs/ADR-008-sync-and-collaboration.md`: ratify two CRDT planes, no
  Loro↔Yjs convergence in pass 1; decide sync-session revocation-latency policy.
- **Impact:** gates N7 (documents) — wave-4a entry.
- **Recommendation:** ratify as drafted; set revocation latency to match receipt-revocation
  semantics chosen in ADR-004.
- **Blocked:** N7 spec; ADR-008 acceptance.

### OD-14 — Password-hash / user-import contract (coined by ADR-002)

- **Evidence:** `reports/notes/wp020-rpc-coverage.md`: `login`/`createAccount`/`changePassword`
  fix a client-side argon2id scheme keyed on `SERVICE_SALT` (api.ts:30).
- **Impact:** only material under OD-1 Branch B (real user data): reproduce the scheme
  client-side or force credential reset. Under Branch A it degenerates to a seed-fixture detail.
- **Recommendation:** decide with OD-1; if Branch B, **force credential reset** unless the old
  FusionAuth store is confirmed exportable in a compatible form (it is slated dead regardless).
- **Blocked:** N20b identity-mapping stage; nothing under N20a.

### OD-15 — Search substrate election checkpoint (coined by ADR-007)

- **Evidence:** `reports/adrs/ADR-007-seven-entity-type-search.md`: ratify D1 FTS5 (+ optional
  Vectorize) after the golden-query gate runs on a prototype, or redirect to a dedicated index.
- **Recommendation:** hold the checkpoint at N16 prototype time; foldable into the OD-5 batch.
- **Blocked:** N16 final substrate commitment (not its design start).

---

## New entries (OD-16..OD-26)

### OD-16 — Standing deferral B: auth mount **[wave-2 blocker]**

- **Sources:** wp000 §B item 3.
- **Evidence:** `merge/route-reconciliation.md` @ `13c2847` — deferral **B** recorded by the
  owner (auth mount location/shape), still open; reconfirmed by 00-baseline §Canonical decisions.
- **Affected ruling:** the deferral itself (owner's own open item); interacts with kernel auth
  adoption (PublicApi/LoginAttempt flows).
- **Impact:** N1 (identity/tenant/auth spine) is the second node on the critical path; its
  route/mount design cannot finalize while B is open.
- **Options/recommendation:** (a) mount auth under the kernel's existing flow (custom shell
  consumes `PublicApi`/`LoginAttempt` directly — recommended: zero kernel change, matches
  ADR-001/002 drafts); (b) preserve old mount paths behind wrapper routes for cutover
  compatibility (only meaningful under OD-1 Branch B with live sessions to honor).
- **Blocked:** N1 finalization; auth-screen parity rows (✔ ruled) implementation.
- **RULING (owner, in-session, 2026-08-20): option (a)** — the custom shell consumes the
  kernel's `PublicApi`/`LoginAttempt` auth flow directly. Deferral B is closed; no legacy mount
  paths are preserved (consistent with the OD-1 fresh-start ruling — no live sessions exist).

### OD-17 — Standing deferral C3: `/.well-known` / native app links

- **Sources:** wp000 §B item 4.
- **Evidence:** `merge/route-reconciliation.md` @ `13c2847` — deferral **C3** standing;
  interacts with mobile-native reality (01 §2.11 K6).
- **Impact:** deep-link/universal-link surface and any future native client hand-off.
- **Options/recommendation:** rule it **with OD-9** in one sitting: if mobile is out of pilot
  scope, C3 collapses to "serve nothing at `/.well-known` for pass 1" (recommended); otherwise
  specify the app-link manifests to serve.
- **Blocked:** route-map completion (KG-9 ingress worker); nothing on the critical path.
- **RULING (owner, in-session, 2026-08-20): collapses with OD-9** — mobile is out of pilot
  scope, so C3 collapses as recommended: **serve nothing at `/.well-known` for the pilot.**
  Deferral C3 is closed; no app-link manifests are served. Revisit only if a native client is
  later ruled in (with OD-9's post-launch revisit). KG-9's ingress route map completes on this
  basis.

### OD-18 — Mega-row splits: documents, DSS-native, Lambda families **[wave-4a gate]**

- **Sources:** wp000 §C item 5; wp010 OD-5 text (named there, split out here as its own
  structural decision).
- **Evidence:** roadmap status log @ `13c2847` "need David rather than more research":
  `documents` row split options G1/G2/G3 (`merge/audits/documents-audit.md` §G), DSS-native
  split N1/N2/N3 (`merge/audits/dss-native-chrome-audit.md`), Lambda-families row options
  (`merge/audits/lambda-batch-families-audit.md`; census verified: exactly 20 handlers + 1 ECS
  worker, 7 families).
- **Affected ruling:** none yet — these rows carry research + options, no verdict.
- **Impact:** N7 is the biggest wave-4a domain and the head of the post-slice critical path; its
  domain spec cannot be written to one scope until the split is picked. The Lambda split decides
  where 20 background jobs land across N7/N13/N14/N15/N17/N20.
- **Options/recommendation:** adopt the audits' recommended split in each case unless the owner
  objects (the audits were written to make this a pick-one decision); rule together with OD-8
  (converter shares the content-location model).
- **Blocked:** N7 spec; wave-4a planning precision; Lambda-dissolution mapping.
- **RULING (owner, in-session, 2026-08-20): all three splits ruled in the OD-5 batch session.**
  Documents: **G1** — three rows (core / annotations / tasks), all parts keep, tasks per the
  OD-7 facet ruling. DSS-native: **N1** four-way split, with **entity_access ruled KEEP** —
  semantics recreated as the receipts subsystem with SEC-1/2/3 fixed; the other three parts are
  plain keeps. Lambda/batch families: **option (a)** — dissolve per family into their owning
  domains; the DLP and ffmpeg members are handled by their own rulings (OD-19 and OD-8
  respectively). N7's domain spec can now be written to one scope. Ledger transcription pending.

### OD-19 — Create and rule the missing DLP row

- **Sources:** wp000 §C item 6.
- **Evidence:** roadmap @ `13c2847`: **DLP has no ledger row** — a daily job that deletes user
  content on policy. No row = no verdict = Q19 default cannot apply (nothing to default).
- **Impact:** a destructive retention job silently missing from scope; affects N17 (activity
  facts are append-only — deletion policy must be designed, not bolted on), decommission
  evidence (08 §7), and any Branch-B migration.
- **Options/recommendation:** add the row; **recommend keep with re-specified policy surface**
  (a deletion job over the new stores, designed with ADR-005 storage-ownership rules), or an
  explicit dated kill if the policy product is dead.
- **Blocked:** N17 retention design; 12-DoD "retention policy" line; cutover gates.
- **RULING (owner, in-session, 2026-08-20): option (b) — row created, then KILLED, on record,
  dated.** There is no automated content-retention deletion job in the new product. The row was
  created precisely so it could be killed with a date: compliance and decommission gates now
  cite an explicit dated verdict rather than an absence. Ledger transcription (new row + dated
  kill) pending.

### OD-20 — Redis successor mapping sign-off

- **Sources:** wp000 §C item 7.
- **Evidence:** 22 crates/services reference redis (stream transport, backfill counters,
  cancellation pub/sub, sha-delete work set — 01 §2.8 H6); no named CF successor in any ruling.
- **Impact:** cross-cutting: affects N3 (queues/outbox), N4 (counters), N9 (pub/sub), N20.
- **Options/recommendation:** no single successor exists by design — **recommend ratifying a
  mapping table** (stream transport → Queues; cancellation pub/sub → DO alarms/hibernation
  signals; counters/work-sets → DO storage or D1) authored inside ADR-005, rather than a
  standalone substrate. Owner signs the mapping, not each use.
- **Blocked:** ADR-005 completeness; per-domain async designs.
- **RULING (owner, in-session, 2026-08-20): option (a) — the mapping table is ratified once,
  inside ADR-005** (stream transport → Queues/kernel sessions; cancellation pub/sub → DO
  alarms/hibernation signals; counters and work-sets → DO storage or D1). The owner signs the
  map, not each of the 22 uses; per-domain designs cite the table. ADR-005 authoring of the
  table is propagation work (sibling agent).

### OD-21 — Create and rule missing rows: frecency + activity-events vocabulary

- **Sources:** wp000 §D item 9 (bullets 3); wp010 recommendation 5; **re-raised as OD-303** by
  `notes/wp030-arch-owner-decisions.md` — now *blocking*, because 04 §12 designs User-DO
  frecency lanes and the D1 activity log against the exact harvested constants, and ADR-005's
  vocabulary registration needs the rows to exist (two load-bearing contracts must not live
  only in prose).
- **Evidence:** frecency engine verified exact (0.7/0.3 weights, 0.1/h decay, 10 events —
  `crates/frecency/src/domain/models.rs:199-205`), consumed by five domains; activity has a
  closed 10-action vocabulary with UUIDv5 ids (`crates/activity/src/domain/models.rs:95-125`);
  **neither has a ledger row**.
- **Impact:** N17's two core engines have no scope authority; renaming an activity action is a
  storage migration, so the vocabulary must be frozen as a contract before any producer emits.
- **Options/recommendation:** add both rows; **recommend keep-faithful with the verified
  constants frozen as parity fixtures** (they are already exact); fold ruling into the OD-5
  batch sitting.
- **Blocked:** N17 spec; event-envelope vocabulary field (N3) finalization.
- **RULING (owner, in-session, 2026-08-20): option (a) — both rows created; keep-faithful with
  the verified constants frozen as parity fixtures** (frecency: 0.7/0.3 frequency/recency
  weights, 0.1/hour decay, last-10 events; activity: the closed 10-action UUIDv5 vocabulary).
  N17 and the N3 event-envelope vocabulary field now have scope authority. Ledger transcription
  (two new rows) pending.

### OD-22 — DynamoDB static-file table: grant harvest access or rule it out of scope

- **Sources:** wp000 §D item 9 (bullet 4); wp010 G-006.
- **Evidence:** `services/static_file_service/src/config.rs` (DynamoDB table name config);
  every handler uses the DynamoDB client; `schema-harvest.md:364` harvested only
  `BulkUploadRequest` — the file-metadata table shape was never captured.
- **Impact:** N14's metadata model is designed blind without it; N20b profiling cannot include
  the store. Interacts directly with OD-1 (if no live data, the *shape* can be reconstructed
  from the client code and access is unnecessary).
- **Options/recommendation:** decide with OD-1: Branch A → **reconstruct shape from code, no
  production access needed** (recommended); Branch B → grant read access for stage-1 profiling.
- **Blocked:** N14 metadata design confidence; N20b stage 1.

### OD-23 — Command-ledger flagged dispositions (bundle of 4 small rulings)

- **Sources:** `reports/notes/wp020-hotkey-coverage.md` §Owner decisions items 1, 3, 4, 5.
- **Evidence pins:** Neuwave @ `9f7a26b`, paths per item.
- **Sub-decisions (rule in one sitting):**
  - (a) Dormant `opt+r` reply-all (`apps/web/src/features/block-email/hooks/emailHotkeys.ts:32`;
    sole caller wires `r` to reply-all instead) — **recommend drop the dormant registration,
    keep observed behavior** (`r` = reply-all), recorded as an intentional difference.
  - (b) Dev-only commands (hotkey debugger, lexical state debugger) — **recommend defer** (out
    of first React pass), as already marked.
  - (c) Known quirks list (leftover `console.log` in cmd+k handlers, `md.copy-branch-name`
    re-registration leak, non-reactive theme loops, canvas `cmd+v` display-only row,
    `email.send` raw-string token) — **recommend fix-not-preserve**, each recorded as an
    intentional difference in the parity ledger.
  - (d) Sidebar `cmd+.` dying on full-cover routes (intentional per source comment) —
    **recommend promote to always-mounted registrar** (consistent behavior), recorded as an
    intentional difference.
- **Impact/blocked:** N5 polish and the visual/keyboard parity gates; nothing structural.

### OD-24 — Brand tripwire renames for commands/themes/storage keys

- **Sources:** `reports/notes/wp020-hotkey-coverage.md` §Owner decisions item 2; 07-UI-UX
  tripwire; A6 (macro-* assets verified present).
- **Evidence:** "MCP setup" command (tags `connect macro`), theme names "Macro Dark"/"Macro
  Light", localStorage keys `macro-*`, Macro logo in command-menu header — Neuwave @ `9f7a26b`.
- **Impact:** tripwire violation if any ships; needed by the first UI wave (N5 skeleton themes).
- **Options/recommendation:** **derive mechanically from the D2 naming ruling** ("Nuewave" /
  "Nuewave T", `merge/README.md`): `nuewave-*` keys, "Nuewave Dark/Light", new logo asset; owner
  confirms passively (objection-only) so wave 2 is not blocked on a naming meeting.
- **Blocked:** N5 theme/system strings; command-menu header asset.
- **RULING (owner, in-session, 2026-08-20): rename ALL Macro branding from day one.** Every
  Macro-branded string, the "Macro Dark"/"Macro Light" themes, all `macro-*` localStorage keys,
  and the "MCP setup" command (tags `connect macro`) are renamed to Outreach OS equivalents
  before any UI ships; the command-menu logo asset is replaced. No `macro-*` identifier may
  appear in the first shipped UI strings (N5 skeleton themes included) — the 07-UI-UX tripwire
  is enforced from the first wave, not deferred to polish.

### OD-25 — Merge-branch pin drift resolution (package hygiene)

- **Sources:** wp000 §E item 10.
- **Evidence:** local `merge/nuewave-docs` = `05436fe`, one commit ahead of package pin/origin
  `8c3cf7a`; content contained in `origin/research/nuewave-longtail` (00-baseline §Repositories).
- **Options/recommendation:** **update `manifest/source-pins.json` to cite
  `research/nuewave-longtail` @ `13c2847` as the single canonical evidence ref** (all Wave-1
  reports already cite it); alternatively fast-forward origin's merge branch or document-and-leave.
- **Blocked:** nothing; prevents future agents resolving citations against the wrong pin.

### OD-26 — Node 24 enforcement (package hygiene)

- **Sources:** wp000 §E item 11.
- **Evidence:** Node 24/pnpm 11 enforced only by `.cursor/Dockerfile` + corepack
  `packageManager`; no `engines` field or `.nvmrc` anywhere (00-baseline §Verified facts 5).
- **Options/recommendation:** **add `engines` (+ optional `.nvmrc`)** so local shells fail fast;
  trivial, no downside identified.
- **Blocked:** nothing; developer-experience hardening.

---

## Entries merged from the WP-030 architecture pass (OD-27..OD-30; aliases OD-30x)

### OD-27 — One projection substrate or two: Soup index vs search index (= OD-302)

- **Sources:** `notes/wp030-arch-owner-decisions.md` OD-302; ledger `search_service` row @
  `13c2847` ("the ruled 'required materialized-index layer' and the search index are the same
  architectural slot and should be designed together, not as two stores" — proposal, verdict
  empty).
- **Affected ruling:** 1a rider (required materialized-index layer); the OD-5 batch names this
  sub-item; distinct from OD-15 (which elects the *technology* after a prototype — this one
  decides *topology*).
- **Impact:** the ADR-006/ADR-007 pair must not freeze without it (the arch note cited
  "ADR-005/ADR-006" under 04's superseded assumed numbering); decides the W3/W7 (04) —
  N4/N16 (05) consumer split.
- **Options/recommendation:** (a) one D1 projection plane, two schema families, shared consumer
  framework — **recommended** (what 04 part A assumes; compatible with either later unification
  or separation); (b) fully unified index (cheaper ops, couples freshness SLOs); (c) fully
  separate services (cleanest blast radius, most moving parts).
- **Blocked:** ADR-006/ADR-007 acceptance (ADR-006 is a wave-2 gate); N4/N16 consumer
  implementation split.
- **RULING (owner, in-session, 2026-08-20): option (a) — one D1 projection plane, two schema
  families, shared consumer framework.** ADR-006/ADR-007 may finalize on this topology.

### OD-28 — Daily whole-workspace memory sweep + Home-recommendations survival (= OD-304)

- **Sources:** `notes/wp030-arch-owner-decisions.md` OD-304; ledger `memory` and
  `ai_projections` rows @ `13c2847` (both verdict-empty; memory generation is "one of the most
  expensive recurring AI costs in the old system"; Home-recommendations "downstream of whether
  the surface exists in an outreach product at all"). Verified constants: memory 24h
  stale-while-revalidate (`crates/memory/src/domain/service.rs:104`); AiFeature tags `Memory`,
  `AiProjection` make spend visible (01 §2.10 J7/J8).
- **Affected ruling:** Q19 default-keep carries both, but Q19 cannot answer a cost/product
  question.
- **Impact:** scopes N10/§14 wrapper work; sets a recurring AI-cost budget line either way.
- **Options/recommendation:** memory — **(b) keep the mechanism, stretch cadence / trigger on
  activity thresholds** (preserves behavior contract, caps cost); Home recommendations —
  **(b) park with business chrome** (N19 owner-spec surface) unless the owner keeps it
  explicitly.
- **Blocked:** N10 wave-4a scope freeze for memory/projections; AI-cost budget sign-off.
- **RULING (owner, in-session, 2026-08-20): keep the memory/profile primitive, refresh
  on user activity** instead of the daily whole-workspace sweep — the behavior contract is
  preserved while the recurring AI cost is capped to active users. Home recommendations ride
  the same on-activity cadence (not parked). Memory and `ai_projections` merge into one
  "materialized agent output" primitive in the N10/§14 wrapper design; the AI-cost budget line
  is set on the on-activity cadence. [= OD-304]

### OD-29 — Team-scoped external credentials model (= OD-305)

- **Sources:** `notes/wp030-arch-owner-decisions.md` OD-305; verified: GitHub App installations
  are the only team-scoped external connection at the pin (`github_app_installation`,
  `source_type ∈ team|user`); kernel connected-accounts/gatekeeper grants are per-user;
  `audits/connectivity-layer-audit.md` §C3 records team-credential sharing as an open gap.
- **Affected ruling:** the P1-centerpiece connectivity ruling (ledger:74) hits this immediately
  (team-shared API keys vs per-user connections for Instantly-class connectors).
- **Impact:** blocks the N10 connectivity design (wave-4a first track per OD-4) and 04 §15
  GitHub scope; touches ADR-002's connector posture.
- **Options/recommendation:** **(a) wrapper-owned team-connection model** — Team-DO custody,
  gatekeeper sessions minted per use; no kernel change (what 04 assumes; consistent with the
  05 §5 zero-kernel-change budget position). (b) kernel extension for team grants requires an
  ADR-014 budget case — not recommended first; (c) per-user-only contradicts harvested GitHub
  behavior.
- **Blocked:** N10 connector-credential design; §15 GitHub scope; ADR-002 connector posture
  note.

### OD-30 — Analytics/telemetry stance: PostHog + Datadog proxy vs kernel-native (= OD-306)

- **Sources:** `notes/wp030-arch-owner-decisions.md` OD-306; ledger `analytics-proxy` row
  (verdict empty — "a stance, not an engineering task"); verified: analytics-proxy is already a
  CF Worker that renames the PostHog session recorder to `runtime.js` to evade ad-block filter
  lists (01 §2.8 H4).
- **Affected ruling:** interacts with the OD-5 batch's analytics-proxy disposition sub-item
  (G-019) — this entry is the *stance*, that sub-item is the *row*.
- **Impact:** every 04 §-Observability block and the CMD-L telemetry parity rows (`hotkey_use`
  etc.) assume some product-analytics sink; PostHog feature flags currently gate onboarding
  generations and sidebar links, so dropping PostHog needs a flag replacement.
- **Options/recommendation:** **(a) keep the proxy + both providers** (fastest, already
  CF-native) — but the recorder-rename ad-block evasion must be decided *explicitly* as a
  privacy/product stance, not inherited silently; (b) Datadog-only (needs a flag replacement);
  (c) kernel-native/none (respec CMD-L telemetry parity rows).
- **Blocked:** observability sink choice in every domain section; flag-gated command rows;
  G-019 worker disposition.
- **RULING (owner, in-session, 2026-08-20, via the OD-5 batch session's S8 item): keep both
  as-is** — the first-party proxy pattern (PostHog + Datadog, server-side key injection) AND
  the session-recorder rename that evades privacy filter lists. **The recorder-rename stance is
  explicitly owned:** it was put to the owner as a distinct yes/no and the owner chose to keep
  the disguise; it is not inherited silently. This substantially resolves OD-30 in favor of
  keeping the PostHog+Datadog proxy pattern; PostHog feature flags therefore need no
  replacement, and the G-019 worker-disposition row is ruled with it (S8 in the packet tally).
  Ledger transcription pending.

---

## Coverage statement

- All six `reports/notes/*.md` files merged; every owner-decision item in them maps to exactly
  one OD above (wp000 items 1→OD-5, 2→OD-5 sub-item, 3→OD-16, 4→OD-17, 5→OD-18, 6→OD-19,
  7→OD-20, 8→OD-8, 9→{OD-6, OD-3, OD-21, OD-22, OD-7}, 10→OD-25, 11→OD-26; wp010 OD-1..10
  verbatim; wp020-rpc → OD-12 (a/b/c) + OD-14; wp020-hotkey items 1,3,4,5→OD-23, 2→OD-24;
  wp030-adr OD-11..15 verbatim; wp030-arch OD-301→OD-12(b), OD-302→OD-27, OD-303→OD-21,
  OD-304→OD-28, OD-305→OD-29, OD-306→OD-30).
- Sibling WP-030 outputs checked last: all fourteen ADR drafts,
  `notes/wp030-adr-owner-decisions.md` (OD-11..15, registered verbatim), and — merged in a
  final reconciliation pass — `04-target-architecture-decisions.md` +
  `notes/wp030-arch-owner-decisions.md` (OD-301..306: one duplicate folded into OD-12, one
  re-raise folded into OD-21, four new → OD-27..OD-30). The ADR note also re-flags for the OD-5
  batch: Redis mapping (→ OD-20 here), frecency/activity/DLP/analytics-proxy/channel-bot
  missing rows (→ OD-21, OD-19, OD-5 sub-items), and whether arbitrary-URL image laundering
  survives the mailbox rebuild (→ OD-6/OD-30).
- Total: **30 owner decisions** (several with bundled sub-items). Graph-blocking set for wave 2:
  OD-7, OD-5, OD-1, OD-16, OD-11, OD-27 (+ OD-4 before WP-040 approval).
