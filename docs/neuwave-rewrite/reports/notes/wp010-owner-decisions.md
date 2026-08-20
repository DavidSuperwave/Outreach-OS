# WP-010 owner decisions needed (mergeable list)

Source: `reports/01-plan-gap-review.md` (2026-08-20). Format matches the
intended `reports/06-owner-decisions-needed.md` ledger: one entry per decision
with evidence, affected ruling, impact, options, and blocked work. Merge these
entries into that file when it is created; IDs are stable (`OD-n`).

---

## OD-1 — Confirm the no-live-data premise; re-scope or activate the migration workstream

- **Evidence:** Ruling 8 (`merge/README.md:52-56` @ research/nuewave-longtail
  `13c2847`): "the four Postgres databases hold no live data, but their
  schemas are harvested"; roadmap status log repeats "schemas harvested / no
  data migration". Package docs `08-DATA-MIGRATION-AND-CUTOVER.md` (7 stages
  incl. dual-run/cutover/decommission), `10-DELIVERY-PLAN.md` (wave-4 item 10),
  `12-DEFINITION-OF-DONE.md` ("Data is migrated and reconciled"), and
  G-013 all mandate live-data migration.
- **Affected ruling:** ruling 8 (2026-08-19).
- **Impact:** the largest single scope swing in the plan. If no live data
  exists anywhere (Postgres, the two DynamoDB tables, Redis, S3, OpenSearch,
  FusionAuth grants), the migration workstream collapses to schema adoption +
  seed fixtures and G-013 closes. If any production/pilot data exists, the
  ledger's premise is broken and 08's machinery is required for those stores.
- **Options:** (a) confirm no live data → shrink 08 to "shape adoption +
  seed", close G-013, delete migration gates from 12-DoD; (b) enumerate the
  stores that do hold data (even small) and scope 08 to exactly those;
  (c) keep 08 as-is (implies rejecting ruling 8's premise — say so explicitly).
- **Blocked work:** WP-020 source profiling; every "migration fixture" release
  gate; DynamoDB static-file harvest access (interacts OD-1↔G-006).

## OD-2 — Record the four "deliberate exceptions" in the ledger, with governance docs

- **Evidence:** `01-AUTHORITY-AND-SCOPE.md` lists four prior rulings (MCP
  server in pilot; ungoverned OpenAI proxy; seven-source search; self-hosted
  converter). At the observed branch pins no dated ruling text exists for any
  of them, and the corresponding ledger rows carry empty verdicts
  (merge-ledger.md rows: mcp_service+mcp_auth_proxy :83; streaming/completions
  :65 — whose research calls `/chat/completions` "the one clear kill
  candidate"; search_service :38; convert_service :82).
- **Affected ruling:** the exceptions themselves (treated here as valid owner
  decisions made outside the recorded ledger, per program instruction).
- **Impact:** the system of record contradicts the package; a future agent
  reading only the branches would kill the proxy and dissolve the MCP server
  with apparent authority.
- **Options:** (a) owner (or scribe with owner sign-off) writes the four
  verdicts into the ledger with dates, plus the boundary/owner/threat-model/
  observability/rollback documentation 01-AUTHORITY §Deliberate exceptions
  itself requires; (b) if any of the four was never actually ruled, say so now
  before WP-030 hardens them into ADRs.
- **Blocked work:** WP-030 ADRs for search, converter boundary, model-layer/
  proxy governance, MCP surface.

## OD-3 — Explicit verdict for notification_service (and the mobile-push channel)

- **Evidence:** merge-ledger.md:75 — provisional "Drop" predates the rulings;
  verdict slot empty; 19 types / 3 egress channels / 11 tables verified exact
  (gap review §2.4); every producer domain is ruled keep; 7 of 19 types are
  GitHub's; mobile push (APNS/FCM incl. iosvoip/CallKit) has no kernel
  analogue and no iOS/Android client source exists in the pinned repo.
- **Affected ruling:** Q19 default-keep currently carries the whole domain by
  default only.
- **Impact:** large build (9.7k non-test LOC equivalent) resting on a default;
  the push channel decision changes external dependencies (APNS/FCM keys) and
  interacts with native-app scope (OD-9) and deferral C3.
- **Options:** (a) keep full incl. push; (b) keep in-app + email digests now,
  defer push until a native client exists; (c) relocate per-domain (rejected
  by the audit's analysis — dropping relocates, not removes).
- **Blocked work:** notifications/realtime ADR (wave 2); GitHub row (7 types);
  channels/mailbox notification emission design.

## OD-4 — Build-order priority: is the agent connectivity layer still the P1 centerpiece?

- **Evidence:** merge-ledger.md:74 — "Build as the P1 outreach centerpiece
  (2026-08-19)". `10-DELIVERY-PLAN.md` sequences "agent connectivity, MCP,
  webhooks, automation" 8th of 10 in wave 4 (labelled a proposal).
- **Affected ruling:** the P1-centerpiece ruling.
- **Impact:** an agent following the package literally inverts the owner's
  product priority; conversely, pulling connectivity forward changes the
  dependency graph (it needs auth + entity registry only, not Soup).
- **Options:** (a) reaffirm outreach-first → WP-030 graph pulls connectivity
  into the first post-slice wave; (b) declare full-absorption parity the
  priority → record that the P1-centerpiece ruling is superseded, with a date.
- **Blocked work:** WP-030 build graph; WP-040 slice choice (a
  connectivity-flavored slice is a live candidate under (a)).

## OD-5 — Close the ledger: 57 researched rows have no verdicts; B and C3 deferred

- **Evidence:** merge-ledger.md at `13c2847`: 101 rows, 43 ruled, 57 `◐` with
  empty verdicts (incl. documents, properties, notification, search,
  webhooks, bots, github, static files, converter, DSS-native split); roadmap
  long-tail log confirms "research-complete, awaiting verdicts". Standing
  deferrals: B (auth mount), C3 (`/.well-known`/native links). Several rows
  need structural choices Q19's default cannot make: documents split G1/G2/G3,
  DSS-native split N1/N2/N3, search substrate, plus missing rows for frecency,
  activity vocabulary, DLP, Redis successor, ffmpeg, analytics-proxy stance,
  the two channel-bot workers.
- **Affected ruling:** Q19 default (keep-faithful) — sufficient for scope, not
  for the named structural choices.
- **Impact:** the package's "closed ledger" framing overstates closure;
  WP-030's build graph would freeze proposals as if ruled.
- **Options:** (a) batch ruling session over the 57 rows + missing rows +
  B/C3; (b) owner delegates the named structural choices to WP-030 ADRs with
  explicit sign-off checkpoints; (c) explicitly bless "Q19 default + audit
  proposals" as buildable authority (record it).
- **Blocked work:** WP-030 ADR set; domain-spec authoring for unruled rows.

## OD-6 — One safe-fetch/SSRF ruling for Workers

- **Evidence:** DNS-resolution-based SSRF defence verified in three services
  (`services/unfurl_service/src/http_safety/mod.rs:91-115`;
  `crates/webhook/src/outbound/http_validator.rs`;
  `services/image_proxy_service/src/api/proxy/resolver.rs` — resolver-level,
  the strongest); Workers cannot resolve-then-decide. Applies also to any
  connector accepting user-entered endpoints (connectivity layer).
- **Affected ruling:** none yet — new design ruling needed (flagged by
  standalone-services audit §C1).
- **Impact:** unfurl, image proxy, outbound webhooks, and connector fetches
  are unbuildable to parity without a decided mechanism (egress proxy
  service/container, Cloudflare-provided filtering, or policy change).
- **Options:** (a) dedicated safe-fetch egress service (container/tunnel) all
  four consumers share; (b) restrict features (e.g., no arbitrary-URL image
  laundering post-mailbox-rebuild — image-proxy row notes it may be
  droppable); (c) accept reduced defence with allowlists (not recommended).
  Parity bar: resolver-level filtering or better.
- **Blocked work:** files/unfurl/image-proxy safety ADR; webhook delivery
  engine; connector endpoint validation.

## OD-7 — Entity-type canonicalization: are `task` and `thread` entities?

- **Evidence:** verified exact — `EntityType` has 16 variants
  (`crates/model-entity/src/lib.rs:34`); `property_entity_type` has 10 values
  incl. `TASK` and `THREAD` which have no `EntityType` variant (migrations
  `20251030100000`, `20251128000000:3-4`, `20260709192942`, `20260726023229`);
  task/snippet/skill are md-block aliases in the frontend.
- **Affected ruling:** D2/2a rider (2026-08-19) — "settle entity-type
  canonicalization first" — this is the decision the rider names.
- **Impact:** blocks the properties domain (largest crate), the entity
  registry id/ontology design (D1/1a rider), and the task model (One Task
  Database invariant, Q20).
- **Options:** (a) task and thread become first-class entity types in the new
  ontology; (b) they remain document facets and the property system gains a
  facet dimension; (c) hybrid (task first-class, thread facet).
- **Blocked work:** entity registry ADR; properties domain spec; WP-040 slice
  (default candidate is a Task flow — it sits directly on this decision).

## OD-8 — Converter and media substrate (LibreOffice + ffmpeg)

- **Evidence:** `services/convert_service` embeds LibreOffice
  (`rs-libreoffice-bindings` @ `056a40d`, Collabora core-co-25.04 assets, MS
  core-fonts EULA in `docker/Dockerfile.convert_service`); ffmpeg only in
  `services/call_recording_preview_handler`. Neither runs on Workers.
- **Affected ruling:** the "self-hosted converter remains" exception (OD-2)
  fixes *that it stays*; the substrate and the ffmpeg sibling are unruled.
- **Impact:** DOCX rendering path (`ConvertedPdf` content location,
  DocumentBom machinery, docx_unzip ingestion) and call-recording previews
  hinge on it; a Cloudflare Container is the only self-hosted-shaped option.
- **Options:** converter — (a) Cloudflare Container running the same
  LibreOffice stack (honors the exception; needs capacity/sandbox/observability
  docs per 01-AUTHORITY); (b) external conversion API (weakens "self-hosted");
  (c) drop DOCX rendering (contradicts the exception — only if owner reverses
  it). ffmpeg — (a) same container pattern; (b) Cloudflare Media
  Transformations; (c) drop call previews.
- **Blocked work:** converter-boundary ADR; documents content-location design;
  media family of the Lambda dissolution plan.

## OD-9 — Native/desktop/mobile scope

- **Evidence:** the Tauri desktop shell **is in the pinned repo**
  (`apps/web/tauri/src-tauri/tauri.conf.json`) and is harvestable; iOS/Android
  app sources are **not** in the repo, while native surfaces demonstrably
  exist (SNS platform endpoints ios/android/iosvoip + CallKit in
  `crates/notification/src/outbound/mobile.rs`; `tauri.localhost` auth
  origins; mobile welcome/QR flows). Deferral C3 (`/.well-known`/app links)
  is standing.
- **Affected ruling:** G-011 classification; C3 deferral; interacts OD-3.
- **Impact:** "faithful recreation" is only verifiable for web + desktop
  (Tauri); mobile-native behavior cannot be harvested from the pin and its
  push/VoIP channels drive external dependencies.
- **Options:** per behavior: keep (web), web replacement, desktop-later
  (Tauri harvest exists), mobile-later (needs sources or respec), or kill.
  Minimum ask: rule whether mobile apps are pilot scope at all.
- **Blocked work:** C3; notification push channel (OD-3); deep-link/route ADR.

## OD-10 — Kernel-change budget enforcement from wave 0

- **Evidence:** `cloudflare-os` pinned at `bf7f762` (2026-08-05); the planning
  branches already carry a kernel patch
  (`patches/sup-536-openrouter-kernel.patch` — SUP-536 OpenRouter work), so
  kernel patching has precedent in this program; upstream velocity is
  unverifiable offline. 04-TARGET's kernel-change budget exists but activates
  at wave 2.
- **Affected ruling:** none — governance gap.
- **Impact:** un-budgeted kernel drift starts on day one (model-layer work),
  compounding upgrade burden (G-012).
- **Options:** (a) declare the budget binding from wave 0 and require an ADR
  retroactively covering the SUP-536 patch if it lands in the new repo;
  (b) accept a named pre-approved patch list; (c) freeze kernel changes until
  the first upgrade rehearsal.
- **Blocked work:** none hard-blocked; affects every wrapper-vs-kernel choice
  starting with the model layer.
