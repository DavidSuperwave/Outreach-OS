# The original Nuewave Pilot plan, reviewed under full absorption

> Written 2026-08-19 from the live Linear project (fetched this day) and the
> confirmed ruling set in `README.md`. This is the bridge between the plan the
> team wrote *before* approval and the merge we are executing now. The future
> scope-map agent should treat the per-issue dispositions here as **draft
> input** to the merge ledger — the full re-audit (ruling 7) can still change
> them.

## What the original plan actually was

Linear project **"Nuewave Pilot"** (55 issues, milestones M0–M6, all issues in
Specification Needed / Todo, nothing started). Its summary line says it all:

> *"Macro × CF-OS merge-by-contract. Hygiene → Work tab → Flow → Broker →
> worklayer → R-9 scoring."*

The architecture behind it — confirmed by David 2026-08-19 — was:

- **Macro (the Neuwave fork) stays the main platform**: the SolidJS app, the
  Rust services, the AWS deployment, four Postgres DBs. Milestone M1 exists to
  move that stack onto owned AWS accounts (Pulumi re-key, VPC→ECR, Doppler,
  fresh FusionAuth, staging cutover).
- **Cloudflare-OS bolts on as a runtime layer and workspace**: M5 creates a
  "CF-OS wrapper repo" deployed at `runtime.superwave.io`, provisions lazy
  per-Channel "Runtime Spaces", and bridges Macro's multi-bot registry to
  them. M4's Broker delegates Tasks from Macro out to provider runners
  (Claude Code, Codex) with a GitHub verifier as the only Done-setter.
- **Merge-by-contract**: the two systems stay separate codebases talking
  through defined seams (Broker session API, message routing, approval-queue
  projection into channel Decisions).

Two facts make the review easy to anchor:

1. **The wrapper repo already exists — it is Outreach-OS.** SUP-500/513
   ("Create CF-OS wrapper repo and deploy runtime.superwave.io") describes
   this very repository. The runtime layer of the old plan grew into the
   platform of the new one.
2. **The absorption ruling inverts the plan's direction.** Old plan: Macro is
   the center, CF is the edge. New ruling: CF-OS is the center, and Macro's
   capabilities are absorbed into it or killed. Every milestone below is read
   through that inversion.

## Milestone-by-milestone disposition

Legend — **Concept**: survives as a concept to rebuild Cloudflare-native
(ledger row). **Dead**: no successor under absorption. **Rescoped**: survives
with a changed object. **Bar**: survives as acceptance criteria rather than
build work. Issues marked *(dup)* were already duplicates in Linear
(SUP-472, 511, 512, 513) — dispositions attach to the canonical copy.

### M0 — Hygiene & portability → almost entirely Dead

Purpose was making the *Macro codebase* shippable and de-branded. With no
Macro codebase shipping, the work items die; two carry value forward.

| Issue | Title | Disposition |
|---|---|---|
| SUP-473 | Frontend service-host env overrides | Dead — CF-OS config model replaces it |
| SUP-474 | Close SEC-1/2/3 auth and share holes | **Concept** — the *hole descriptions* are design input for the new auth/sharing model. Harvest the SEC-1/2/3 write-ups from the Neuwave repo/docs before scoping auth. |
| SUP-475 | Harden cloud-verify GitHub Actions recipe | Dead — CI gets designed fresh for Outreach-OS |
| SUP-476 | Swap interim Nuewave mark, DB-1 de-brand | Dead as work; the *rule* survives as the branding tripwire |
| SUP-477 | Bring up Docker stack + document recipe | Dead — though the Docker stack is now a **research asset**: the easiest way for an auditing agent to see the old platform running |
| SUP-478 | Absorb user-facing Workspace label | Dead — naming decisions happen in the ledger |
| SUP-479 | Supersession banners on live Nuewave docs | Dead — superseded by this folder |
| SUP-480 | Rename agent identity to Nuewave | **Rescoped** — the Nuewave agent identity now applies to the CF-OS build (D2: product = Nuewave) |
| SUP-481 | Remove dead websocket-service / coding-agent-worker configs | Dead — but flags that `coding-agent-worker` and `sync-service` were *already Cloudflare*; check them during re-audit as possible direct harvests |

### M1 — Infra cutover → Dead as a milestone

The whole milestone moves the AWS stack to owned accounts. Absorption drops
AWS entirely.

| Issue | Title | Disposition |
|---|---|---|
| SUP-470 | Provision P0 accounts and secrets | **Rescoped** — already carried in `../roadmap.md` P0 as Cloudflare accounts, AI Gateway keys, deploy hostname |
| SUP-482 | Re-key Pulumi org off macro-inc | Dead |
| SUP-483 | Deploy core AWS stacks VPC→ECR | Dead |
| SUP-484 | Doppler workspace with ECS injection | Dead |
| SUP-485 | Re-provision Cloudflare Workers/D1/KV/R2, sweep macroverse | **Rescoped** — the sweep half is dead; the provisioning half is P0 reality in Outreach-OS |
| SUP-486 | CORS + connection_gateway origins → superwave.io | Dead — CF-OS serves same-origin |
| SUP-487 | GitHub-hosted runners for workflow generators | Dead |
| SUP-488 | Fresh FusionAuth → superwave.io issuers | Dead — Cloudflare Access replaces FusionAuth |
| SUP-489 | Deploy staging, point frontend-dev at it | Dead — staging story gets designed fresh |
| SUP-492 | Audit cutover for zero Macro-account traffic | Dead — nothing runs on Macro accounts at all |

### M2 — Work tab → survives whole as Concepts

The product heart of the old plan: Tasks in channels, list + kanban, saved
views. All five issues become ledger rows, now with readable source for
faithful recreation (harvest rules, ruling 1).

| Issue | Title | Disposition |
|---|---|---|
| SUP-490 | Task-to-channel relation + channelId filter | **Concept** — conditional on the Channels verdict (old D3, re-opened by the re-audit) |
| SUP-491 | Seed four Work-tab system properties | **Concept** — the property system (`crates/properties`) is now readable; harvest the actual four |
| SUP-493 | Channel Work tab with embedded SoupViewList | **Concept** — Work surface on CF-OS; Soup list mechanics readable in `crates/soup` + `apps/web/src/features/` |
| SUP-495 | TaskKanban on STATUS-keyed generic PropertyKanban | **Concept** — kanban recreation, faithful UI now allowed |
| SUP-497 | Un-gate views chrome, generalize share URLs | **Concept** — sharing/views model, cross-ref SEC-1/2/3 findings |

### M3 — Flow and policy → survives, and the kernel already covers much of it

| Issue | Title | Disposition |
|---|---|---|
| SUP-494 | Thin Flow entity (no graph/PlanRevision) | **Concept** — maps onto kernel agent sessions; ledger decides what a Flow *is* natively |
| SUP-498 | AgentSession + AgentActivity, idempotent streaming | **Concept, largely native** — CF-OS durable resumable sessions already provide the substance; re-audit decides the delta |
| SUP-499 | Task Owner and Delegate metadata | **Concept** — task model fields |
| SUP-515 | Action Policy Service skeleton in action_queue | **Concept, largely native** — kernel approval queue + Gatekeeper capability scoping is this |
| SUP-517 | Per-session scoped MCP catalog filtering | **Concept** — maps to `gatekeeper-mcp` scoping |

### M4 — Broker / runner / verifier → concepts survive, substrate is replaced

| Issue | Title | Disposition |
|---|---|---|
| SUP-502 *(canon; 512 dup)* | ECS runner cluster, no ambient credentials | Dead as ECS; the **no-ambient-credentials property** transfers to the CF-native runner as a requirement |
| SUP-516 | Broker provider-neutral session API | **Concept** — the seam design survives; kernel agent-spawner is the natural home |
| SUP-523 | Claude Code adapter (non-interactive) | **Concept** — provider adapter on the new runner substrate |
| SUP-526 | Normalize runner events → AgentActivity + input requests | **Concept** — event normalization into the session model |
| SUP-527 | Broker-backed Delegate actions in DispatchAgentMenu | **Concept** — UI seam; DispatchAgentMenu recreation now permitted |
| SUP-528 | Codex CLI adapter (provider switch proof) | **Concept** — second adapter proves neutrality |
| SUP-531 | Diff branch + PR artifacts on Task and Flow | **Concept** — artifact model on tasks |
| SUP-532 | GitHub verifier as the only Done setter | **Concept** — the verifier-gated-Done invariant, unchanged |

### M5 — Worklayer certification → the inversion epicenter

This milestone built the bridge between the two platforms. With one platform,
bridges become native features or die.

| Issue | Title | Disposition |
|---|---|---|
| SUP-496 | Bridge Macro multi-bot registry → Runtime Spaces | Dead as a bridge — re-audit decides if a *bot registry* concept survives natively |
| SUP-500 *(canon; 513 dup)* | Create CF-OS wrapper repo, deploy runtime.superwave.io | **Done in spirit** — Outreach-OS is that repo; the `runtime.superwave.io` hostname question lives in P0 |
| SUP-518 | Spike managed principal identity with revocation proof | **Concept** — re-asked against Cloudflare Access; the revocation-proof requirement stands |
| SUP-519 | Lazy per-Channel Runtime Space provisioning | Dead as a bridge — natively this is just session/DO lifecycle; ledger row under workspace model |
| SUP-520 | Route external messages to spawner-configured thread | **Concept, largely native** — `external-message-gateway.ts` exists in CF-OS; delta only |
| SUP-522 | Certify one throwaway-vendor connector slice | **Concept** — connector pattern certification, now against Gatekeeper sessions (Instantly read-only is the live case) |

### M6 — Track merge and scoring → survives as the Bar

| Issue | Title | Disposition |
|---|---|---|
| SUP-471 | Select five scoring Tasks | **Bar** — founder-gated, carries to P3 |
| SUP-501 *(canon; 511 dup)* | Shake out smoke-repo harness | **Bar** — smoke harness against the new build |
| SUP-521 | Coordinator spawner joins pilot channel as bot | **Concept** — conditional on Channels verdict |
| SUP-524 | Record founder full-loop walkthrough | **Bar** — human-only, carries |
| SUP-525 | Audit zero ambient-credential violations | **Bar** — the P.C criterion, unchanged |
| SUP-529 | Project CF approval queue into channel Decisions | **Largely native** — the approval queue *is* CF-OS's; "Decisions surface" becomes a UI ledger row |
| SUP-530 | Prove Flow resumes after killed runner | **Bar** — kill-survival criterion; kernel durability should make this cheap |
| SUP-533 | Run five founder tasks to GitHub-verified Done | **Bar** — the R-9 scoring finale |

## The tally

Of 55 issues (51 canonical + 4 duplicates):

- **Dead under absorption: ~17** — all of M1 except two rescopes, most of M0,
  the M5 bridge plumbing. These are the fork-and-AWS assumptions.
- **Survive as Concepts (ledger rows): ~22** — all of M2, M3, M4's seams and
  verifier, parts of M5. This is the product.
- **Survive as the Bar (acceptance criteria, mostly P3): ~7** — M6 minus its
  conditionals.
- **Rescoped: ~4** — accounts/secrets, CF provisioning, agent identity.
- **Already done in spirit: 1** — the wrapper repo (this repository).

## What the original plan protects that the merge must not lose

The project description's "**Do not break**" list is the old team's own
statement of load-bearing structure, and it maps directly to merge-ledger
rows: *Soup/Block/Split/Entity/Team/Channel nouns; frozen `ai_toolset`;
share-permission semantics; Project=Folder; one Task database.* The re-audit
must give each of these an explicit row — either the recreation preserves the
invariant or a ruling consciously drops it. The lane system, push policy, and
on-disk authority chain (`19_BUILD_HANDOFF.md` › `18_DECISION_RECORD.md` › …)
are dead process, but those handoff documents exist in the Neuwave repo and
should be read once during re-audit for decisions that still bind.
