# Nuewave-native rebuild — roadmap & governance

> Decision date: 2026-08-19
> Status: living document — update the Status log at the bottom every working session
> Companion docs (same folder): `cf-os-capability-map.md` · `platform-parity-map.md` ·
> `shell-ux-rebuild-plan.md` · `agents-ai-plan.md`

This is the stitching document for the Nuewave-native rebuild. It records why the
plan changed, the licensing ground rules every future session must follow, the
phased roadmap, what happens to the two old Linear projects, and how multi-session
work stays coherent.

## 1. Decision record (2026-08-19)

**What changed.** The Nuewave Pilot was a merge-by-contract fork of the Macro
platform (`DavidSuperwave/Neuwave`). Legal review with leadership concluded that
shipping anything built on that fork would require open-sourcing the pilot under
the upstream license — even a heavily modified fork. The team chose not to go
that route, and that choice is respected: **the Macro-fork path is dead.**

**What was green-lit instead.** Leadership approved a **component rewrite**: the
team rebuilds the product concepts (not the code) natively around the Cloudflare
OS build that already lives in this repository (`Outreach-OS`, built from
`cloudflare-os-starter` with the pinned `cloudflare-os` submodule). The
platform-context documentation branch (`cursor/platform-context-docs-2f7d` in
`DavidSuperwave/Neuwave`, `docs/internal/platform-context/`) is the concept-level
functional reference for what the old platform did.

**Consequences.**

1. **Cloudflare-native, deliberately.** The pilot is led by the Cloudflare OS
   build. Building it natively on Cloudflare (Workers, KV, R2, Gatekeepers,
   Workers AI / AI Gateway) keeps the pilot clearly distinct from Macro's
   product and stack, so the rewrite does not undermine Macro.
2. **AWS is dropped.** The entire AWS provisioning track of the old Nuewave plan
   (ECS, VPC/ECR, Doppler, FusionAuth, Pulumi, staging cutover) is dead. There
   is no infra cutover because nothing will run on Macro or AWS accounts.
3. **Outreach OS is no longer a standalone project.** Its scope — OpenRouter
   models, Context playbooks + Intraplex ICP, inspect-ask-table, Instantly
   reads — becomes the **first workload** of this rebuild. One repo, one
   project, one roadmap (this one).

## 2. Clean-room / licensing ground rules

> **SUPERSEDED 2026-08-19.** David obtained permission to use the Neuwave
> repo. The binding rules are now the **harvest rules** in `merge/README.md`
> (ruling 1): read anything, rewrite Cloudflare-native, faithful UI/UX
> recreation allowed; only two tripwires survive — **no Macro branding** and
> **no Rust code reuse**. The section below is kept for history only; where it
> conflicts with the harvest rules, the harvest rules win. Session-protocol
> rule 6 in §4 is superseded the same way.

These rules bind every future session, human or agent. They exist so the
rewrite stays legally clean. When in doubt, stop and ask.

**Allowed**

- Reading and using `docs/internal/platform-context/` (README, feature-map,
  platform-canvas, ui-ux-component-catalog, revision-agent-brief) as
  **functional specs**: they describe concepts, flows, and vocabulary, not
  implementation.
- Reimplementing product *concepts* (Work tab, task kanban, Flow/AgentSession,
  verifier-gated Done, approval queues) from scratch on the Cloudflare OS
  extension points.
- Reading upstream `cloudflare-os` source freely — that is the platform we
  build on, under its own license, unmodified per the starter's trust model.

**Forbidden — the tripwires**

1. **No copying, porting, or paraphrasing Macro/Neuwave source.** Not a file,
   not a function, not a "translated to TypeScript" version of a Rust crate or
   a SolidJS component. If a session finds itself opening
   `DavidSuperwave/Neuwave` code files to write code here, that is the line
   being crossed.
2. **No file-by-file or component-by-component translation.** Structure the new
   code around Cloudflare OS idioms (Gatekeepers, Session APIs, gadgets,
   Context), never around Macro's crate/feature layout.
3. **No Macro asset reuse.** No icons, illustrations, CSS tokens, SVGs, fonts,
   prompts, or copy lifted from the Macro repo.
4. **No Macro branding or naming collisions.** The pilot does not present
   itself as Macro; entity nouns may be generic (task, channel, flow) but
   Macro-specific trade dress stays out.
5. **Concept docs in, code out.** Agents may hold the platform-context docs in
   context. They must not be given Macro source files as context for
   implementation work.

Record in commit messages when a feature is a clean-room reimplementation of a
documented concept (e.g. "clean-room: Work-tab concept per platform-context
feature-map").

## 3. Phased roadmap

Phases are sequential gates; items inside a phase can run in any order unless
noted. Each item names the Linear issues it carries forward (re-scoped to the
Cloudflare-native build) so history is traceable.

### P0 — Foundation: the OS runs, models load, spend is safe

The platform must be usable before any workload lands.

| Item | Carried from | Notes |
|---|---|---|
| Fix Home model loading for OpenRouter | SUP-536 (In Progress, current branch), SUP-535 (duplicate — close into 536) | Active work; Path B parked notes in `docs/sup-536-openrouter-changes.md` |
| OpenRouter through AI Gateway, spend fail-closed | SUP-465 | See `agents-ai-plan.md`; AI Gateway billing doc in `cloudflare-os/docs/ai-gateway-billing.md` |
| Run locally, confirm Home | SUP-463 | Definition of done unchanged |
| Admin brand, Context enabled, standing instructions | SUP-464 | Also absorbs the *intent* of old de-brand/rename issues (SUP-476/480): identity is now `/admin` branding config, not a code de-brand |
| Decide + execute deploy target (own domain) | SUP-500/513 re-scoped | The old "CF-OS wrapper repo" ask is satisfied by *this repo*; remaining work is deploying it to an owned hostname (e.g. a superwave.io host). Human-only: DNS, Access, secrets |
| Provision secrets (Cloudflare, OpenRouter, Instantly) | SUP-470 re-scoped | AWS/Doppler portions dead; secrets are human-only, never in Linear or tracked config |

**Gate:** local + deployed OS reachable, agent answers with an OpenRouter model,
spend caps proven fail-closed.

### P1 — First workload: Outreach (the old Outreach OS pilot)

| Item | Carried from | Notes |
|---|---|---|
| Seed Playbooks + Intraplex ICP/company Context | SUP-466 | Context collections, not app code |
| Prove inspect → ask → table loop on one lead file | SUP-467 | Table gadget survives refresh; agent asks before building |
| Design Instantly **read-only** Session API, stop for review | SUP-469 | Human review gate before implementation |
| Implement Instantly read Gatekeeper (no send/activate) | SUP-468 | No send/activate method may exist; supersedes the old "throwaway-vendor connector pattern slice" (SUP-522) as the connector-certification exercise |

**Gate:** Instantly reads land in a results gadget from a seeded-Context
conversation; zero send capability in the codebase.

### P2 — Work surfaces: the Nuewave concepts, rewritten

Clean-room reimplementations of the concepts the fork was going to deliver.
Specs come from `platform-parity-map.md` and `shell-ux-rebuild-plan.md`.

| Concept (old milestone) | Carried from | Rewrite shape |
|---|---|---|
| Work tab: task list + kanban in a work surface (old M2) | SUP-490, SUP-491, SUP-493, SUP-495 | Task entities with system properties (status, owner, delegate, due), list + kanban views as OS gadgets/surfaces — not a SoupViewList port |
| Task owner/delegate metadata | SUP-499 | Property model on the new task entity |
| Thin Flow entity + AgentSession concept (old M3) | SUP-494, SUP-498 | A task can hold a flow with a pending agent session; state survives restart. Built on OS session primitives — see `cf-os-capability-map.md` |
| Per-session scoped tool/MCP catalog | SUP-517 | Gatekeeper/MCP catalog scoping per session |
| Approval queue surfaced where work happens | SUP-529, SUP-515 (concepts) | Lean on the OS's native approval/HITL surface rather than a custom Action Policy Service; only build policy skeleton if the OS surface proves insufficient |

**Gate:** create a task → it appears in list and kanban; a task holds a flow
with a pending agent session that survives a restart.

### P3 — Hardening, verification & scoring

| Item | Carried from | Notes |
|---|---|---|
| Verifier-gated Done: an external check (e.g. GitHub CI) is the only Done setter (old M4) | SUP-532, SUP-531 | Artifacts (branch/PR links) attach to task/flow |
| Kill-survival: flow resumes after a killed runner | SUP-530 | Durability proof on the Cloudflare runtime |
| Smoke-repo harness | SUP-501 (dup SUP-511) | Scoring path shakeout |
| Zero ambient-credential audit | SUP-525 | Gatekeeper secret model makes this largely structural; audit proves it |
| Select five scoring tasks (human) | SUP-471 | Founder decision |
| Run five founder-selected tasks to verified Done (old M6 / R-9-style bar) | SUP-533 | The scoring bar for the pilot |
| Founder full-loop walkthrough recording (human) | SUP-524 | Closes the pilot |

**Gate:** five tasks GitHub-verified Done; kill-survival and credential audits
pass; walkthrough recorded.

### Killed outright (do not carry forward)

All items tied to the Macro fork's codebase or the AWS cutover:

- **AWS/infra cutover:** SUP-482 (Pulumi), SUP-483 (VPC→ECR), SUP-484
  (Doppler/ECS), SUP-485 (re-provision Macro's CF workers), SUP-486 (CORS
  origins), SUP-487 (workflow runners), SUP-488 (FusionAuth), SUP-489
  (staging cutover), SUP-492 (cutover audit), SUP-502 (+dup SUP-512, ECS
  runner cluster), SUP-518 (managed principal spike — deferred indefinitely),
  SUP-519/520/521 (Runtime Spaces / spawner / coordinator bot), SUP-496
  (Macro multi-bot registry bridge).
- **Macro-codebase work:** SUP-473 (frontend env overrides), SUP-474 (SEC-1/2/3
  holes in Macro auth), SUP-475 (fork cloud-verify CI), SUP-476/478/479/480
  (de-brand/rename/banners — intent absorbed into P0 branding), SUP-481
  (dead service configs), SUP-497 (un-gate views chrome), SUP-527
  (DispatchAgentMenu), SUP-526 (runner-event normalization — absorbed by OS
  session activity), SUP-523/528 (Claude/Codex CLI adapters — the OS model
  layer replaces broker adapters; revisit only if P3 demands it), SUP-516
  (broker-neutral session API — absorbed by OS session model), SUP-477
  (+dup SUP-472, Macro Docker stack), SUP-522 (superseded by SUP-468/469).
- **Duplicates:** SUP-472, SUP-511, SUP-512, SUP-513, SUP-535.

## 4. Session protocol (multi-session working agreement)

1. **One phase item per session.** Pick the next unblocked item from the
   current phase. Do not start a later phase before the gate passes.
2. **Read first:** this roadmap + the one companion doc that owns the item
   (capability map for platform questions, parity map for "what did the old
   thing do", shell plan for UI, agents plan for AI/tooling).
3. **Plans are living documents.** When implementation contradicts a plan doc,
   fix the doc in the same session — code wins, docs follow.
4. **"Meet in the middle" rule:** when a shell/UX decision and a platform
   decision conflict (e.g. the shell plan wants a surface the OS doesn't
   extend cleanly), the conflict is resolved *here*, in the roadmap, as a
   dated entry in the Status log — not silently in one doc.
5. **End every session** by appending to the Status log: date, item worked,
   state (done / in progress / blocked+why), and any roadmap changes.
6. **Clean-room rules (section 2) apply to every session and every spawned
   agent.** Briefs for subagents must not include Macro source.

## 5. Proposed Linear cleanup (recommendation only — human applies)

No Linear changes have been made. Suggested, in order:

1. **Nuewave Pilot project:** replace description with a pointer to this
   roadmap; note the fork is dead for licensing and the project is now the
   Cloudflare-native rebuild. Keep the name or rename to "Nuewave Native".
2. **Cancel the killed issues** listed above (bulk-cancel with a comment
   linking this doc); mark SUP-472/511/512/513/535 as duplicates if not
   already.
3. **Re-scope carried issues** (SUP-470, 490, 491, 493, 494, 495, 498, 499,
   500, 501, 515, 517, 525, 529, 530, 531, 532, 533, 471, 524) with a
   one-line "Cloudflare-native rewrite" note and this doc as the spec anchor,
   or close them and cut fresh issues per phase — founder's call.
4. **Merge the Outreach OS pilot project into Nuewave Pilot** (or vice versa)
   so there is one project; its issues SUP-462..469, 536 map to P0/P1 above.
   SUP-462 can be closed as done (this repo exists).
5. **Milestones:** replace the old M0–M6 with P0–P3.

## Open questions

1. **Deploy hostname:** which owned domain hosts the pilot (runtime.superwave.io
   was the old plan) — founder decision, needed by end of P0.
2. **Task/Flow storage:** which OS-native storage (typed-storage/KV vs. a
   Gatekeeper-owned store) backs task entities — to be answered by
   `cf-os-capability-map.md` findings during P2 planning.
3. **Verifier integration:** GitHub App vs. plain API token for the P3
   verifier, and where its secret lives — decide at P3 entry.
4. **Linear cleanup timing:** apply section 5 now or after P0 proves out —
   founder's call.
5. **Naming:** does the rebuilt pilot keep the "Nuewave" name externally, or
   is that reserved for the (dead) fork lineage?

## Status log

- **2026-08-19** — Roadmap created as part of the five-doc planning set
  (workstreams A–E). No implementation work this session. Next: P0 items,
  starting with SUP-536 (already in progress on
  `david/sup-536-home-cannot-load-ai-models-for-openrouter`).
- **2026-08-19 (later)** — Milestone audit of both Linear projects completed;
  David chose not to move or cancel anything yet. Section 5's cleanup is
  superseded by `linear-decision-tree.md` (all 65 issues, 7 branches, direction
  decisions D1–D6, every row `Pending`). Proposed project rename "Nuwaves T"
  recorded pending spelling confirmation (D2). Linear untouched. Next: David
  rules on D1–D6, then a session applies the rulings.
- **2026-08-19 (later still)** — `MISSION.md` added as the folder's entry
  point: mission, direction, survival list (platform-context docs +
  decision ledger), and the interview-agent brief for the next pass. The
  platform-context concept docs were copied into
  `reference/platform-context/` so they survive in-repo. Next session: run
  the interview per MISSION.md §"The next pass".
- **2026-08-19 (merge session)** — Grill session produced eight confirmed
  rulings (see `merge/README.md`): clean-room superseded by harvest rules
  (permission obtained; tripwires: no Macro branding, no Rust reuse), merge =
  full absorption into Outreach-OS, D1 ruled (one Linear project, "Nuewave
  T"), D2 ruled (product = Nuewave), re-audit everything, full endpoint
  extraction, schemas harvested / no data migration. Neuwave `main` cloned
  and pinned at `9f7a26b`. `merge/` folder created: README (rulings),
  original-linear-plan-review (M0–M6 dispositions under absorption),
  merge-ledger scaffold, agent-brief, and agent-generated inventories
  (backend endpoints, frontend routes/splits/blocks, Postgres schemas).
  Linear untouched; nothing committed. Next: research slices fill the ledger,
  David rules on rows in batches.
- **2026-08-19 (ruling pass 1)** — David ruled the merge ledger 1-by-1 (Q10–
  Q21, recorded in `merge/merge-ledger.md` with dates): channels **keep
  full**; split-layout shell recreated faithfully; soup UX faithful on native
  RPC (graphql_soup killed); "Instantly read-only" framing corrected to the
  **agent connectivity layer** (Composio-style MCP+API, P1 centerpiece);
  company mailbox keep **in pilot**; CRM keep in pilot; calls+calendar+
  reminders+activity all keep; all four already-CF services **lifted as-is**
  (WASM carve-out to the no-Rust rule; route reconciliation is a first-class
  design task); **real auth rebuilt** (Access is not the model); kernel is
  the one agent runtime with old chat/agent UX on top (ai_toolset semantics →
  Gatekeeper session APIs); **keep-faithful is the ledger default**; the five
  old invariants preserved; business chrome parked to end (primitives
  documented — something different planned); data patterns parked pending a
  per-pattern agent review (domain- vs substrate-motivated). Standing rule
  added to `merge/agent-brief.md`: source over Linear — capabilities are
  described from code, never from issue text. Next: pattern review + route
  reconciliation + per-domain deep audits, then business chrome, then the
  scope-map pass.
- **2026-08-19 (merge review pass)** — The three ordered workstreams executed
  (five research agents over the pinned clone + kernel; outputs in `merge\`):
  **`pattern-review.md`** — all four parked patterns reviewed from source with
  adopt/replace options (glue: domain ontology / substrate encoding; EAV:
  split — custom props real, system-fields-as-EAV substrate; outbox + leases:
  ~purely substrate, kernel has DO-native idioms; the one genuine kernel gap
  is EAV-style cross-entity filtering). **`route-reconciliation.md`** —
  unified route map vs the CF-OS router: `/api` is a single capnweb RPC WS
  (not a REST namespace) ⇒ R1/R2/R3 surface-model options; lifted services
  proposed at `/sync` `/lexical` `/ai-editing` with an L1/L2 strip decision;
  20-item collision register; **coding-agent-worker is EMPTY at the pin**
  (nothing to lift). **`audits/`** — three P1 deep audits:
  connectivity-layer (9-gap delta; no Instantly connector exists anywhere;
  old catalog = hardcoded FE constant), CRM (email-traffic-derived
  populate/depopulate; **contacts_service is NOT CRM** — user-connections
  graph, ruled on a wrong premise), company-mailbox (24 not 26 `email_*`
  tables; push sync via GCP Pub/Sub stays a hard dependency; Gmail-API
  two-phase send, no SMTP; FusionAuth held the OAuth grants — custody must
  move). Ledger research columns updated (7 rows + 3 pattern rows);
  agent-brief corrected (old team's handoff docs don't exist at the pin).
  Nothing committed; Linear untouched. Next: David takes ruling batches
  A–E (route model, auth mount, conventions, four patterns, corrected
  premises), then the business-chrome primitives doc, then remaining ledger
  rows, then the scope-map pass.
- **2026-08-19 (ruling session)** — All five batches ruled by David
  (grill-style, one question at a time; rulings recorded in the ledger and
  as dated "Ruled:" lines in the review docs, unchosen options preserved):
  **D (patterns): 1a/2a/3a/4a** — adopt the Entity=(type,id) ontology with
  rebuilt storage (registry + tombstones + required materialized-index
  layer; id format settled first), adopt property semantics with values on
  the entity record (filter-index layer is first-class design; entity-type
  canonicalization first), outbox discipline as intent+alarm (no tables),
  DO-single-writer + alarms for jobs (external-mutation fencing kept).
  **A (routes): R3** hybrid RPC-first surface; **L1** router-strips with
  `/sync` `/lexical` `/ai-editing` confirmed; **A3: coding-agent-worker
  dropped from the lift set** — a full all-refs/all-history search of both
  repos (background agent) proved no source was ever committed anywhere and
  the bun.lock (`daytona-bun-hello`; Daytona SDK + Ink CLI, zero CF deps)
  was never a Cloudflare Worker; lift set is three services; a future
  coding-agent capability is a new ☐ ledger row (new scope, not a lift).
  **B (auth mount): explicitly deferred** to auth design time.
  **C: C1** connection_gateway superseded by kernel `/api` session push;
  **C2** unified `/hooks/<source>/*` webhook ingress; **C3 deferred** to
  the native-app-links/MCP-host rows. **E: contacts_service re-ruled** on
  the corrected premise — keep as its own capability in the pilot
  (standalone user↔user connections graph, independent of CRM).
  **`business-chrome-primitives.md` written** (background agent during the
  grill, Q19 parked-prepare: billing/paywall role-driven via
  `read:professional_features`, Stripe webhook on authentication_service;
  onboarding = one `user_onboarding` row served via DCS mount; getting-
  started is frontend-only localStorage). README carve-out corrected (three
  lifted services). Nothing committed; Linear untouched. Next: research the
  remaining ☐ ledger rows, then the Linear scope-map pass.
