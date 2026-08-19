# Claude Code kickoff — research pass

> Paste the block under **Prompt** into a new Claude Code session with cwd
> `Outreach-OS` on branch `merge/nuewave-docs`. This is the local-agent
> version of the same job as `next-agent-prompt.md` (cloud). It restates
> David's first-message setup so the session does not depend on Cursor
> chat history.

**Do not skip env reconstruction.** Neuwave is a separate repo. Nothing
from it was pushed into Outreach-OS. If `../Neuwave` is missing or not at
the pin, stop and clone it before filling any ledger row.

---

## What you are walking into (David's first message)

| | |
|---|---|
| Build repo | [DavidSuperwave/Outreach-OS](https://github.com/DavidSuperwave/Outreach-OS) |
| Branch | `merge/nuewave-docs` |
| Merge home | `docs/plans/nuewave-native/merge/` |
| Direct tree | https://github.com/DavidSuperwave/Outreach-OS/tree/merge/nuewave-docs/docs/plans/nuewave-native/merge |
| File to **read first** | [`cloud-handoff.md`](./cloud-handoff.md) |
| File that was the **paste kickoff** | [`next-agent-prompt.md`](./next-agent-prompt.md) |
| Reference repo | `DavidSuperwave/Neuwave` — clone yourself, sibling dir named `Neuwave` |
| Pin | `9f7a26bccb85e6f806a6e0c8d6c8e53f3a3541bf` (`9f7a26b`) |
| Isolation | **Nothing from Neuwave was pushed anywhere.** Harvest is read-only. Write pointers + CF-native proposals into Outreach-OS docs only. |

Orientation written after that message (same folder / parent):

| File | Use in Claude Code |
|---|---|
| [`handoff-map.md`](./handoff-map.md) | Picture of the two-repo setup, pipeline, ledger snapshot, launch checklist |
| [`../reference/platform-context/feature-map.md`](../reference/platform-context/feature-map.md) | Routes, splits, Soup views, blocks, feature trees |
| [`../reference/platform-context/ui-ux-component-catalog.md`](../reference/platform-context/ui-ux-component-catalog.md) | `@ui` primitives, chrome, Entity/Property/Message, block families |
| [`../reference/platform-context/platform-canvas.md`](../reference/platform-context/platform-canvas.md) | Shell → API → deployables → stores |
| [`endpoint-inventory-frontend.md`](./endpoint-inventory-frontend.md) | Pin-accurate frontend inventory (27 routes, 28 splits, 16 blocks) |

Cursor canvases (`nuewave-merge-handoff`, `nuewave-product-shape`) are IDE-only. Do not look for them here; the markdown above is the same content.

---

## Local env (this machine)

```text
/Users/david/Projects/Outreach-OS     ← cwd, branch merge/nuewave-docs
/Users/david/Projects/Neuwave         ← MUST exist as sibling; checkout the pin
```

```bash
cd /Users/david/Projects/Outreach-OS
git submodule update --init cloudflare-os

# If the harvest clone is missing:
cd /Users/david/Projects
git clone git@github.com:DavidSuperwave/Neuwave.git Neuwave
cd Neuwave
git checkout 9f7a26bccb85e6f806a6e0c8d6c8e53f3a3541bf
```

Confirm `git rev-parse --short=7 HEAD` in Neuwave prints `9f7a26b` before any research.

---

## Prompt

Paste everything between the lines:

---

You are running the **research pass** for the Nuewave × Outreach-OS full absorption, in **Claude Code**, cwd Outreach-OS, branch `merge/nuewave-docs`.

David's setup (do not invert):

- **Build repo:** `DavidSuperwave/Outreach-OS` — all work lands here. Merge docs: `docs/plans/nuewave-native/merge/`. Tree: https://github.com/DavidSuperwave/Outreach-OS/tree/merge/nuewave-docs/docs/plans/nuewave-native/merge
- **Two starter files:** read `docs/plans/nuewave-native/merge/cloud-handoff.md` in full first, then treat `docs/plans/nuewave-native/merge/next-agent-prompt.md` as the job spec. Follow cloud-handoff §1 before any ledger edits.
- **Reference repo:** `DavidSuperwave/Neuwave` is **not** in this git history and was **never pushed** into Outreach-OS. Clone it yourself as a **sibling directory named `Neuwave`** and `git checkout 9f7a26bccb85e6f806a6e0c8d6c8e53f3a3541bf`. The pin is law. Every `[NW]` pointer is `path:line` against that SHA. Never cite `main`.
- Init the `cloudflare-os` submodule. `[CF]` pointers resolve there.

All five ruling batches (A–E) were ruled by David on 2026-08-19. Patterns, route model, and corrected premises are settled. You do not build product code. You never write a `Verdict:`.

**First action:** reconstruct env if `../Neuwave` is missing or not at `9f7a26b`. Then read, in order:

1. `docs/plans/nuewave-native/merge/cloud-handoff.md`
2. `docs/plans/nuewave-native/merge/handoff-map.md` (orientation; ledger/inventories win on conflict)
3. the §2 read order in cloud-handoff (README, agent-brief, merge-ledger, pattern-review, route-reconciliation, audits/, business-chrome-primitives, inventories, schema-harvest, MISSION + roadmap Status log)
4. For UI/route/feature shape: `docs/plans/nuewave-native/reference/platform-context/feature-map.md` and `ui-ux-component-catalog.md` (harvested Macro web app: 27 routes, 28 production splits, 11 Soup views, 16 blocks, `@ui` primitives). Cross-check against `merge/endpoint-inventory-frontend.md`.

Do not start research before that. Do not regenerate inventories or the ledger.

**Your work, in order:**

1. Research still-open ☐ ledger rows, highest-leverage first:
   1. documents (versions, annotations, blocks — cross-check schema-harvest + frontend block types)
   2. projects (folders/containers; Project = Folder is a preserved invariant)
   3. properties (EAV domain *surface*; D2/2a already fixed storage direction)
   4. search_service + search_processing_service
   5. connection_gateway internals (superseded by kernel `/api` session push, C1 — enumerate event types)
   6. Lambda/batch families (~20 handlers, never extracted — `infra/`, deploy configs, queue consumers)
   then as time allows: favorites, foreign_entity, webhook, bots, github, DSS-native chrome, memory, import, onboarding, ai_usage, ai_projections, streaming/completions, notification_service, static_file_service, unfurl_service, image_proxy_service, scheduled_action, convert_service, analytics-proxy, frontend ◐ rows, block types, table groups.
2. For each row: fill research columns (old pointers, what it does, endpoint/schema cross-refs, proposed CF-native target under the ruled patterns, effort). Leave `Verdict:` empty. Cite D1/D2/D3/D4, R3, C1/C2 when they shape the target — do not re-argue them.
3. Deep audits under `merge/audits/` (same format as the existing three) when a row warrants it — documents and the Lambda families almost certainly do.
4. If David is present, offer grill-style ruling batches (one question, concrete options). If he is absent, do not simulate rulings — leave rows ◐.

**Rules:** Verdicts are David's. No Macro branding. No Rust reuse (lift set is three: sync, lexical, ai-editing). No Linear writes. State coverage. Doc updates on `merge/nuewave-docs` are allowed; nothing else without an explicit order.

**Done when:** the six highest-leverage rows are fully researched; any extra rows you reached; coverage stated; roadmap Status log updated; closing restatement of remaining ☐/◐ rows plus deferrals B (auth mount) and C3 (`/.well-known`).

---
