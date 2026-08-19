# Nuewave-native rebuild — plan index

> Created 2026-08-19. Living documents; every session updates the Status log in
> `roadmap.md`. Authority: current code wins over these plans.

The Nuewave pilot cannot ship as a Macro fork (license would force
open-sourcing). The team green-lit a component **rewrite**: Cloudflare-native,
built around the pinned Cloudflare OS in this repo, AWS dropped, and the
Outreach OS pilot merged in as the first workload. **Clean-room rule:** Macro/
Neuwave source is never copied, ported, or paraphrased; the platform-context
docs on `DavidSuperwave/Neuwave` branch `cursor/platform-context-docs-2f7d`
(`docs/internal/platform-context/`) serve as a concept-level functional spec
only. Full tripwires are in `roadmap.md`.

## Reading order

| Doc | What it answers |
|---|---|
| [MISSION.md](./MISSION.md) | **Read first** — why this exists, the direction, the files that must survive, and the interview-pass brief for the next agent |
| [linear-decision-tree.md](./linear-decision-tree.md) | The decision ledger: all 65 Linear issues across both projects, 7 branches, direction decisions D1–D6, all Pending |
| [cf-os-capability-map.md](./cf-os-capability-map.md) | What the OS already gives us, every no-fork extension point, and the hard walls |
| [platform-parity-map.md](./platform-parity-map.md) | Domain-by-domain keep/defer/drop verdicts and the AWS → Cloudflare data mapping |
| [shell-ux-rebuild-plan.md](./shell-ux-rebuild-plan.md) | The pilot's surface inventory and how each is built (upstream / gadget / Gatekeeper App) |
| [agents-ai-plan.md](./agents-ai-plan.md) | Model layer (OpenRouter via AI Gateway), agent-runtime mapping, tool/Gatekeeper roadmap, guardrails |
| [roadmap.md](./roadmap.md) | Decision record, clean-room rules, phases P0–P3, Linear carry-forward/kill list, session protocol, **Status log** |
| [reference/platform-context/](./reference/platform-context/) | Frozen copy of the old platform's concept docs (the clean-room functional spec) — do not delete |

## Cross-workstream agreements

- **We build no agent runtime.** The Workshop kernel already provides durable
  resumable agent turns (kill-survival), an approval queue, capability-scoped
  per-chat Gatekeeper bindings (no ambient credentials is structural), a
  scheduler, spawners, and MCP. Old-Nuewave Flow ≈ chat thread, AgentSession ≈
  ActiveAgentRecord; the Broker/ECS runner fleet is dead. GitHub-as-only-
  Done-setter survives as a wrapper-side verifier via `gatekeeper-github`.
- **Milestone 1 is the model layer:** OpenRouter through AI Gateway with
  fail-closed spend, closing SUP-536 + SUP-465 together, including the
  pin/patch/upstream decision for `patches/sup-536-openrouter-kernel.patch`.
- **The one substantial original UI is the Work surface** (list + kanban).
  Everything else is upstream adoption, admin config, Context seeding, or a
  certified gadget/blueprint.
- **Hard wall to design around:** no cross-workspace data plane — each
  workspace is an isolated Overseer DO. Unified lists need wrapper-side
  indexing or scope cuts; do not rebuild Macro's Soup.
- **Only real new backend build:** the Instantly read-only Gatekeeper (no
  send/activate method may exist in the session type).

## Open conflict to resolve first (decision pending)

**Shell strategy.** The capability map found the whole frontend is replaceable
(`workshop-frontend` is a pure SPA over a documented Cap'n Web RPC API; the
router serves whatever SPA is in `ASSETS`) — "Option B: wrapper-owned custom
shell." The shell/UX plan instead assumed the conservative route: keep the
upstream shell and add the Work surface as a sandboxed-iframe Gatekeeper App,
flagging that the sidebar/routes/editor chrome are upstream-owned. These are
both viable and mutually exclusive for where the Work tab lives.

Recommended resolution: run the **shell spike** named in `roadmap.md`'s open
questions during P0/P1 (before P2 starts): prototype the Work surface as a
Gatekeeper App first (cheapest, upgrade-safe); adopt the custom-shell route
only if the App sandbox blocks a P2 requirement (deep-linking, nav badge,
shared selection state). Record the outcome in the Status log and update
`shell-ux-rebuild-plan.md`.
