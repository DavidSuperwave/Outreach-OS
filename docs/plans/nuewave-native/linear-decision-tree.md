# Linear reconciliation — decision tree

> Created 2026-08-19. Covers **every issue in both projects** (Outreach OS pilot: 10,
> Nuewave Pilot: 55 — 65 total). Nothing in Linear has been changed. Each entry
> carries a recommendation and a `Decision:` slot — David rules on each, then a
> session applies the outcome. Companion: `roadmap.md` (phases P0–P3).

## How to read this

Every issue lands in one of seven branches. Branches 1–3 are mechanical once the
direction decisions (D1–D5) are made; branches 4–5 are the real judgment calls.

| Branch | Meaning | Count |
|---|---|---:|
| 1. Adopt | Already correct for the rebuild; milestone/status fix only | 9 |
| 2. Re-scope | Survives with a rewritten description (AWS parts cut) | 2 |
| 3. Duplicates | Close as duplicate, no debate | 5 |
| 4. Recreate | Concept survives; issue text is fork-specific → move+rewrite or close+recut | 12 |
| 5. Conditional | Disposition depends on a direction decision below | 5 |
| 6. Human-gated | Founder actions; carry unchanged | 3 |
| 7. Kill | Tied to the Macro fork or AWS cutover; no successor | 29 |

> **2026-08-19 update:** the clean-room constraint was lifted (permission obtained
> to use the Neuwave repo; see `merge/README.md` for the new rules — only Macro
> branding and verbatim Rust reuse stay forbidden), D1/D2 were ruled below, and a
> **full re-audit** of every capability was ordered: verdicts in this file and the
> parity map are provisional until re-checked against actual source. The merge
> audit lives in `merge/`. D4 is effectively superseded by the D1 ruling (fresh
> scope cut from the audit, not per-issue moves) — confirm before applying.

## Direction decisions (rule on these first)

| # | Decision | Options | Recommendation | Decision |
|---|---|---|---|---|
| D1 | One project or two? | Merge into one project / keep both | Merge — Outreach OS pilot becomes the single project; Nuewave Pilot is archived with a pointer | **Ruled 2026-08-19: one merged Linear project replaces both.** Both existing projects get closed/archived once the new scope lands. The new scope is written from the merge audit (`merge/`) by a separate, explicitly-confirmed pass — the 65 rows here become audit input, not a per-issue migration checklist. |
| D2 | Project name | "Nuwaves T" (as given — confirm exact spelling) / keep "Outreach OS pilot" / other | Confirm the exact name before renaming | **Ruled 2026-08-19: product = "Nuewave"; the merged Linear project is titled "Nuewave T"** (the "T" is a Linear-only team marker signalling this is the post-decision project). |
| D3 | Channels in the pilot? | In scope (phase 2+) / out of pilot scope | Out for the pilot — parity map defers channels; affects SUP-490, 493, 521, 529 | **Ruled 2026-08-19: KEEP FULL** — channels recreated faithfully including the messaging surface (overrides both the parity map's "keep thin" and the shell plan's "drop"). SUP-490/493/521/529 concepts all live. |
| D4 | Carry mechanics for Branch 4 | Move existing issues + rewrite descriptions / close and cut fresh issues | Move + rewrite (keeps IDs and history) | **Pending** |
| D5 | Kill timing for Branch 7 | Cancel now with roadmap-link comment / park until P0 gate passes | Cancel now — board reflects reality | **Pending** |
| D6 | Milestones | Rename M0→P0, M1→P1, M2→P2, add P3 / build fresh milestone set | Rename + add (keeps progress history) | **Pending** |

## Branch 1 — Adopt (Outreach OS pilot, correct as written)

Milestone fixes only; the OpenRouter trio is currently misfiled in "M1 Context
and table loop" though it gates everything.

| Issue | Title | Today | New home | Note | Decision |
|---|---|---|---|---|---|
| SUP-536 | Home cannot load AI models for OpenRouter | In Progress, M1 | **P0** | Active on `david/sup-536-...`; kernel patch endgame is roadmap OQ | Pending |
| SUP-465 | OpenRouter through AI Gateway, spend fail-closed | Todo, M1 | **P0** | Pairs with 536 as milestone 1 of the agents plan | Pending |
| SUP-464 | Admin brand, Context enabled, standing instructions | Spec Needed, M1 | **P0** | Also absorbs the *intent* of dead de-brand issues 476/480 | Pending |
| SUP-463 | Run Cloudflare OS locally and confirm Home | Spec Needed, M0 | **P0** | Unchanged | Pending |
| SUP-462 | Create outreach-os repo from starter | Todo, M0 | **P0 → close Done** | This repo exists | Pending |
| SUP-466 | Seed Playbooks + Intraplex ICP Context | Spec Needed, M1 | **P1** | Content/config, no app code | Pending |
| SUP-467 | Prove inspect → ask → table loop | Spec Needed, M1 | **P1** | Becomes a certified gadget/blueprint | Pending |
| SUP-469 | Design Instantly read-only Session API, stop for review | Spec Needed, M2 | **P1** | Human review gate stays | Pending |
| SUP-468 | Implement Instantly read Gatekeeper (no send/activate) | Spec Needed, M2 | **P1** | The one real backend build of P1 | Pending |

## Branch 2 — Re-scope (Nuewave issues that survive with cut-down scope)

| Issue | Title | Old home | New shape | Decision |
|---|---|---|---|---|
| SUP-470 | Provision P0 accounts and secrets | M1 Infra cutover | **P0** — Cloudflare + OpenRouter + Instantly secrets only; AWS/Doppler parts dead; human-only | Pending |
| SUP-500 | Create CF-OS wrapper repo and deploy runtime.superwave.io | M5 Worklayer | **P0** — wrapper repo exists (this one); remaining work = deploy to an owned hostname (domain choice is roadmap OQ #1) | Pending |

## Branch 3 — Duplicates (close, no debate)

| Issue | Duplicate of | Decision |
|---|---|---|
| SUP-535 | SUP-536 | Pending |
| SUP-472 | SUP-477 | Pending |
| SUP-511 | SUP-501 | Pending |
| SUP-512 | SUP-502 | Pending |
| SUP-513 | SUP-500 | Pending |

## Branch 4 — Recreate (fork-worded issues whose concept survives)

Descriptions reference Macro internals (SoupViewList, PropertyKanban, DB-1,
action_queue…). The concept carries; the text must be rewritten clean-room
against the plan docs. Mechanics per D4.

**Work surface (→ P2)** — spec: `shell-ux-rebuild-plan.md`

| Issue | Old title | Rewritten concept | Decision |
|---|---|---|---|
| SUP-491 | Seed four Work-tab system properties | Task entity with status/owner/delegate/due system fields | Pending |
| SUP-493 | Add channel Work tab with embedded SoupViewList | Work surface: task **list** view (Gatekeeper App or custom shell — see shell spike) | Pending |
| SUP-495 | Port TaskKanban onto STATUS-keyed PropertyKanban | Work surface: **kanban** view keyed on status | Pending |
| SUP-499 | Add Task Owner and Delegate metadata | Owner/delegate on the new task model | Pending |

**Flow / sessions (→ P2)** — spec: `agents-ai-plan.md`, `platform-parity-map.md`

| Issue | Old title | Rewritten concept | Decision |
|---|---|---|---|
| SUP-494 | Thin Flow entity without graph or PlanRevision | Flow-on-task backed by OS chat threads | Pending |
| SUP-498 | AgentSession + AgentActivity with idempotent streaming | Map to kernel ActiveAgentRecord semantics; wrapper adds nothing unless proven missing | Pending |
| SUP-517 | Per-session scoped MCP catalog filtering | Per-chat Gatekeeper/MCP scoping (kernel bindings largely provide this — verify then close or slim) | Pending |

**Verification & scoring (→ P3)** — spec: `agents-ai-plan.md` §verifier

| Issue | Old title | Rewritten concept | Decision |
|---|---|---|---|
| SUP-532 | GitHub verifier as the only Done setter | Verifier via gatekeeper-github polling PR merge state | Pending |
| SUP-531 | Attach diff branch and PR artifacts on Task and Flow | Artifact links on the new task/flow model | Pending |
| SUP-530 | Prove Flow resumes after a killed runner | Kill-survival proof on DO/kernel resume (kernel guarantee — this becomes a test, not a build) | Pending |
| SUP-501 | Shake out smoke-repo harness | Unchanged in spirit; target repo TBD | Pending |
| SUP-525 | Audit sessions for zero ambient-credential violations | Audit proves what per-chat frozen bindings make structural | Pending |

## Branch 5 — Conditional (blocked on a direction decision)

| Issue | Old title | Depends on | If yes | If no | Decision |
|---|---|---|---|---|---|
| SUP-490 | Task-to-channel relation + channelId filter | **D3 channels** | Recreate as task↔workspace/context relation | Fold into 493's filter spec | Pending |
| SUP-529 | Project CF approval queue into channel Decisions | **D3** + OS approval surface sufficiency | Recreate as approval surface where work happens | Kill — kernel approval queue UI suffices | Pending |
| SUP-515 | Action Policy Service skeleton in action_queue | OS approval rules sufficiency (probe in P2) | Recreate as wrapper policy layer | Kill — kernel auto-approve rules suffice | Pending |
| SUP-521 | Join coordinator spawner to the pilot channel as a bot | **D3 channels** | Recreate on external message gateway seam | Kill | Pending |
| SUP-518 | Spike managed principal identity with revocation proof | Post-pilot appetite | Defer to post-pilot backlog | Kill | Pending |

## Branch 6 — Human-gated (carry unchanged → P3)

| Issue | Title | Decision |
|---|---|---|
| SUP-471 | Select five scoring Tasks | Pending |
| SUP-533 | Run five founder-selected Tasks to GitHub-verified Done | Pending |
| SUP-524 | Record founder full-loop walkthrough | Pending |

## Branch 7 — Kill (no successor; cancel per D5)

**Macro-codebase hygiene (old M0)** — the codebase they touch is gone from scope:
SUP-473 (frontend env overrides), SUP-474 (SEC-1/2/3 holes in Macro auth),
SUP-475 (fork cloud-verify CI), SUP-476 (de-brand mark), SUP-477 (Macro Docker
stack), SUP-478 (Workspace label), SUP-479 (supersession banners), SUP-480
(rename agent identity), SUP-481 (dead service configs).
*476/480 intent lives on in SUP-464 (admin branding).*

**AWS infra cutover (old M1)** — no cutover exists anymore:
SUP-482 (Pulumi re-key), SUP-483 (VPC→ECR), SUP-484 (Doppler/ECS), SUP-485
(re-provision Macro's CF resources), SUP-486 (CORS origins), SUP-487 (workflow
runners), SUP-488 (FusionAuth), SUP-489 (staging cutover), SUP-492 (cutover
audit).

**Broker/runner core (old M4)** — replaced by the Workshop kernel + AI Gateway:
SUP-502 (ECS runner cluster), SUP-516 (broker-neutral session API), SUP-523
(Claude Code adapter), SUP-526 (runner-event normalization), SUP-527
(DispatchAgentMenu delegate actions), SUP-528 (Codex adapter — provider switch
is now model choice through the gateway).

**Worklayer (old M5)** — superseded or out of scope:
SUP-496 (Macro multi-bot registry bridge), SUP-519 (per-channel Runtime
Spaces), SUP-520 (external message routing — the OS gateway seam replaces it if
ever needed), SUP-522 (connector-pattern slice — superseded by SUP-468/469).

**M2 stragglers:** SUP-497 (un-gate Macro views chrome).

| Kill decision (all 29 as a block, or line-item vetoes) | Decision |
|---|---|
| Cancel all above with a comment linking `roadmap.md` | Pending |

## Resulting milestone map (if D1/D6 accepted)

| Milestone | Issues |
|---|---|
| **P0 Foundation** (rename M0) | 463, 464, 465, 536, 470, 500 (+462 closed Done, 535 closed dup) |
| **P1 Outreach workload** (rename M1) | 466, 467, 469, 468 |
| **P2 Work surfaces** (rename M2) | 491, 493, 495, 499, 494, 498, 517 (+490/515/529 per Branch 5) |
| **P3 Hardening & scoring** (new) | 532, 531, 530, 501, 525, 471, 533, 524 |

## Open questions

1. Exact project name — "Nuwaves T" was given; confirm spelling/casing before renaming.
2. Whether SUP-517 and SUP-498 survive at all once the kernel's per-chat bindings and ActiveAgentRecord are verified in P2 — they may close as "already provided, test only".
3. Where decisions get recorded: this file is the ledger; a session applies each ruled row to Linear and flips `Pending` → the ruling + date.
