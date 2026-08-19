# Mission — what we are doing here and why

> Created 2026-08-19. Read this first, before any other file in this folder.
> Owner: David (founder). Working repo: `Outreach-OS`. Status: planning →
> interview pass → execution.

## The one-paragraph version

The Nuewave pilot was going to be built on a fork of the Macro platform. Legal
review killed that path: shipping anything on the fork would force open-sourcing
it under the upstream license. Leadership green-lit a **rewrite instead** — the
product *concepts* get rebuilt natively on the Cloudflare OS that lives in this
repo, AWS is dropped entirely, and the Outreach OS pilot stops being a separate
project and becomes the rebuild's first workload. This folder is the complete
working memory of that pivot: what the old platform did, what the OS gives us,
what we're building, what dies, and what David still has to decide.

## The two target repos

Everything in this effort touches exactly two repositories. Their roles are
opposite and must not blur:

| Repo | Role | Rules |
|---|---|---|
| [`DavidSuperwave/Outreach-OS`](https://github.com/DavidSuperwave/Outreach-OS) | **The build repo.** This repo — where the Cloudflare-native rewrite happens and where this plans folder lives. Carries the `cloudflare-os` submodule (upstream `cloudflare/cloudflare-os`). | All new code lands here. |
| [`DavidSuperwave/Neuwave`](https://github.com/DavidSuperwave/Neuwave) | **The reference repo.** The old Macro-fork platform being absorbed. Cloned locally at `C:\Users\Kecin\Projects\Neuwave`, pinned to `main@9f7a26b` (see `merge/README.md`). | **Harvest rules (2026-08-19, supersede clean-room):** permission obtained — read everything, rewrite Cloudflare-native, faithful UI/UX recreation allowed. Two tripwires: no Macro branding, no Rust code reuse. |

## Why an audit of both Linear projects

Both Linear projects predate the pivot and describe work that no longer matches
reality:

- **Nuewave Pilot** (55 issues, milestones M0–M6) assumes the Macro fork: its
  hygiene and infra-cutover milestones are 100% dead, its Broker/ECS runtime is
  replaced by the OS kernel, but its *product* milestones (Work tab, Flow,
  verifier-gated Done, scoring) survive as concepts.
- **Outreach OS pilot** (10 issues, milestones M0–M2) is directionally right but
  misfiled — the OpenRouter/model-layer issues that gate everything sit in a
  mid-plan milestone instead of the foundation.

The audit result is `linear-decision-tree.md`: all 65 issues sorted into seven
branches (adopt / re-scope / duplicates / recreate / conditional / human-gated /
kill), plus six direction decisions (D1–D6: one project or two, project name,
channels in scope, move-vs-recreate mechanics, kill timing, milestone strategy).
**Every row is Pending. Nothing in Linear has been changed.** Linear gets
updated only after David rules.

## The direction

1. **Cloudflare-native, deliberately.** Workers, Durable Objects, KV/R2/D1,
   Queues, Access, AI Gateway. No AWS, no Postgres fleet, no FusionAuth. This
   keeps the pilot clearly distinct from Macro's product and stack.
2. **The OS leads.** The Workshop kernel already provides the agent runtime
   (durable resumable sessions, approval queue, capability-scoped Gatekeeper
   bindings, scheduler, MCP). We build at the edges — Gatekeepers, Context,
   gadgets, surfaces — and treat kernel changes as a budget spent near zero.
3. **Harvest-and-rewrite** *(2026-08-19 — replaces the original clean-room
   rule; permission obtained)*. Neuwave source is open as reference: read
   anything, rewrite it Cloudflare-native, recreate the UI/UX faithfully.
   Only two tripwires remain — **no Macro branding** (icons, trade dress,
   agent identity) and **no Rust code reuse** (rewrite only). The merge audit
   lives in `merge/`; the platform-context doc set remains the concept map.
4. **Outreach is workload #1.** OpenRouter models loading (SUP-536/465) →
   Context playbooks + ICP → inspect-ask-table → **agent connectivity layer**
   *(corrected 2026-08-19: the earlier "Instantly read-only" framing was a
   misunderstanding — the real feature is a Composio-style MCP + API
   connector layer letting agents pull external data into the workspace;
   Instantly is simply the first connected source. The company mailbox/inbox
   is a separate capability, ruled separately in the merge ledger.)* Then the
   Work surfaces and the verification/scoring bar.

## The files that must survive

Two sets of files are load-bearing for every future session. Do not delete,
regenerate from memory, or "clean up" either set.

**1. The platform-context concept docs** — `reference/platform-context/`
(copied 2026-08-19 from `DavidSuperwave/Neuwave`, branch
`cursor/platform-context-docs-2f7d`, path `docs/internal/platform-context/`).
These are the verified concept maps of what the old platform did: feature map,
architecture canvas, UI/UX catalog, plus their README and revision brief. They
are the *functional spec* for the rewrite — concepts in, code out. They
describe Macro's current state as of 2026-08-19 and are frozen here as
reference; the living copy stays on the Neuwave branch.

**2. The decision file** — `linear-decision-tree.md`. The ledger of record for
the reconciliation. Rulings get written into its `Decision:` slots with dates.
Linear is only ever changed to match a dated ruling in that file.

## Folder map

| File | Role |
|---|---|
| `MISSION.md` | This file — read first |
| `README.md` | Index, cross-workstream agreements, the shell-strategy conflict |
| `roadmap.md` | Decision record, clean-room rules, phases P0–P3, session protocol, **Status log** |
| `linear-decision-tree.md` | **The decision ledger** — 65 issues, 7 branches, D1–D6 |
| `cf-os-capability-map.md` | What the OS provides; extension points; hard walls |
| `platform-parity-map.md` | Old domain → keep/defer/drop → Cloudflare-native mapping |
| `shell-ux-rebuild-plan.md` | Surface inventory; what UI gets built and how |
| `agents-ai-plan.md` | Model layer, agent runtime mapping, Gatekeeper roadmap |
| `reference/platform-context/` | Frozen concept docs of the old platform (functional spec) |
| `merge/` | **The merge audit (2026-08-19 →)** — rulings, pinned Neuwave clone, endpoint/route/schema inventories, the merge ledger, agent briefs. Read `merge/README.md` after this file. |

## The next pass: the interview

The plans above were drafted by agents from documents. Before execution, every
build item needs **David's answers, not an agent's assumptions**. The next
session runs as a structured interview:

### Interview agent brief

You are running the requirements interview for the Nuewave-native rebuild.
Your job is to question David about **each single thing we are building and its
structure**, one area at a time, and record his rulings. You are not building
anything and not changing Linear.

**Prepare:** read `MISSION.md`, `linear-decision-tree.md`, and `roadmap.md` in
full. Read the relevant section of the owning plan doc before each interview
area. Consult `reference/platform-context/` when a question needs "what did the
old thing actually do".

**Interview order (one area per block; don't move on until the block's
questions are ruled or explicitly parked):**

1. **Direction decisions D1–D6** — these unblock everything else. D2 needs the
   exact project name spelled out ("Nuwaves T" is recorded but unconfirmed).
2. **P0 foundation** — deploy hostname; the SUP-536 kernel-patch endgame
   (pin/fork/upstream); AI Gateway spend limits (actual numbers); which secrets
   exist today and which need creating.
3. **P1 outreach workload** — what the Playbooks/ICP Context actually contains
   and where the source material lives; what a "lead file" is (format, sample);
   what the Instantly account can expose read-only; what the results table
   must show to be useful.
4. **P2 work surfaces** — the task model field by field (statuses, owner,
   delegate, due — what values, who sets them); list vs. kanban expectations;
   what Flow means to David in one sentence; whether the shell spike outcome
   (Gatekeeper App vs. custom shell) changes his expectations; each conditional
   issue (SUP-490/515/529/521/518) resolved with its D3 dependency.
5. **P3 verification & scoring** — what "Done" means, exactly; which repo the
   smoke harness targets; what the five scoring tasks might be; what the
   walkthrough must demonstrate.
6. **Structure & naming** — entity nouns we keep (task, flow, workspace…),
   what "Nuewave" refers to going forward, anything from the old platform's
   vocabulary David wants preserved or banned.

**Method:** ask in small batches (3–4 questions max per exchange), concrete
options over open-ended prompts where the plans already offer options, always
with an escape hatch for "neither — here's what I actually want". Challenge
vague answers once ("what would that look like on screen?") but accept a park.

**Record:** every ruling goes into `linear-decision-tree.md` (for D1–D6 and
issue dispositions) or into a new `interview-log.md` in this folder (for
requirements detail), dated. End the session by appending to the roadmap
Status log. After D1–D6 are ruled, applying them to Linear is a separate,
explicitly-confirmed step.

**Bounds:** clean-room rules apply (`roadmap.md` §2) — never pull Macro source
to answer a question; the concept docs are the limit. Do not modify Linear, do
not start building, do not re-litigate the pivot itself.

## Definition of done for the planning phase

- D1–D6 ruled and dated; conditional branch resolved.
- `interview-log.md` covers every P0–P3 item with David's answers.
- Linear updated to match the ledger (one confirmed pass).
- Then, and only then: execution sessions begin at P0 per `roadmap.md` §4.
