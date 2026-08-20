# ADR-008 — Sync and collaboration (two CRDT planes)

- Status: Proposed (Draft — owner decides; see OD-13)
- Date: 2026-08-20
- Owners: David (decision); WP-030 drafting agent (proposal)

## Context

Two collaborative-editing systems exist at the pins, on different CRDTs:

1. **Neuwave document collaboration** — `services/sync-service` @ `9f7a26b`
   (Rust/WASM, DO+D1, 18 routes, WebSocket): **Loro CRDT** sync for document
   content. Ledger verdict (research/nuewave-longtail @ `13c2847`):
   **"Lift as-is (2026-08-19)"** — one of the three lifted CF services, the
   WASM exception to the no-Rust rule. Documents do not own their live bytes:
   `DocumentContentLocation::SyncService` is one of the 5 content locations
   (`crates/documents/src/domain/content.rs:26-38`).
2. **Kernel workspace-code collaboration** — cloudflare-os @ `bf7f762`
   already ships a **Yjs (V2 encoding) doc per workspace** with a full
   draft/merge/revert model: `Overseer.subscribeToCode`/`updateCode(update,
   chatId?)` (api.ts:1355-1372; per-chat live drafts), `mergeChanges` /
   `revertChanges` / `finalizeChatDraft` / `discardChatDraftChanges`
   (api.ts:1540-1560), provisional `changes` batches with
   `observedCodeVersion` locks, provisional gadget creations/bindings, and
   draft replay via `AiChatSubscriber.draftUpdate`/`draftCleared`
   (api.ts:2370-2376). Revert **erases changes from the Yjs history**
   (api.ts:1855-1870).

The trap this ADR closes: an implementer "unifying collaboration" would
either port Loro docs onto the kernel's Yjs code plane or rebuild sync-service
— both violate rulings.

## Source and ruling constraints

- Ledger: sync_service (domain) + sync-service (deployable) **Lift as-is
  (2026-08-19)**; integration requirement: routes reconciled into the unified
  route model. Route ruling **L1**: router strips lifted prefixes (`/sync`).
- ADR-002 freeze: the kernel Yjs trio is part of the 182-surface freeze
  (`mergeChanges`, `revertChanges`, `finalizeChatDraft`,
  `discardChatDraftChanges`, `updateCode`, `subscribeToCode`, plus
  draft-replay subscriber methods).
- Kernel-change budget: no modification of the kernel code-sync plane.
- lexical-service / ai-editing-worker: ruled Lift (2026-08-19), same
  route-reconciliation requirement; ai-editing's `edit_traces` D1 schema is
  one of the two already-D1 schemas.

## Decision

**Proposed: keep two CRDT planes, each authoritative for its own content
class; no unification in the first pass.**

1. **Document content plane (Loro)**: lift sync-service unmodified, mounted
   per L1 under `/sync` behind the wrapper router; it remains the
   authoritative backend for `SyncService`-located document content. Its DO+D1
   state stays under its own ownership (ADR-005 manifest entries). The
   documents domain keeps the content-location indirection and treats
   sync-service as an authority it does not control (ledger documents row).
2. **Workspace code plane (Yjs V2)**: adopt the kernel's code doc +
   draft/merge/revert trio as-is for workspace/gadget code and agent-proposed
   changes. The custom shell (ADR-001) surfaces merge/revert/draft states
   through the frozen RPC surface only.
3. **Bridges are explicit, read-only extraction paths**, not doc sharing:
   search text extraction from Loro docs (ADR-007's `/extract_sync`
   successor), and lexical/ai-editing workers keep their lifted contracts.
   No component holds both planes' docs in one CRDT.
4. **New collaborative surfaces** (channels message drafts, canvas, etc.)
   must state which plane they join, or justify per-surface OT/CRDT choice in
   their domain spec — defaulting to the document plane for entity content.

## Alternatives considered

1. **Rebuild document sync on kernel Yjs.** Rejected: contradicts the dated
   Lift ruling; CRDT migration (Loro→Yjs) has no parity oracle; the kernel
   plane is workspace-code-shaped (files-root Y.Maps, chat-branch drafts,
   version locks) — not a general document store.
2. **Port kernel code collab onto sync-service (Loro).** Rejected: kernel
   change of the largest kind; breaks the frozen draft/merge/revert surface
   and agent tooling (`observedCodeVersion` session locks).
3. **Unified new CRDT layer over both.** Rejected for pass 1: maximal risk,
   zero rulings support it; revisit only as a post-parity simplification with
   its own ADR.

## Compatibility impact

- Kernel trio semantics (draft materialization on merge with
  `includeDraft`, revert erasing history, provisional gadget
  creations/bindings dying with reverts) are frozen behavior — the shell must
  render them faithfully.
- sync-service's 18 routes + WS remain wire-compatible for its clients after
  the L1 prefix strip; that route reconciliation is a named integration task,
  the old AWS-side conflict being the reason it is first-class.

## State and authorization impact

- Loro plane: sync-service's own DO+D1 state (lifted as-is). Access to open a
  sync session is gated by document receipts (ADR-004) at the wrapper router
  before the WS reaches the lifted service.
- Yjs plane: kernel authorization applies (capability chain; default-deny use
  role wrappers).
- Content-location model keeps authorization at the document domain: holding
  a sync-session handle must not outlive receipt revocation (session
  re-validation policy stated in the documents domain spec).

## Migration and rollback

- OD-1 Branch A: nothing to migrate. Branch B: Loro doc state migrates as
  opaque sync-service state (its own D1/DO export), never re-encoded.
- Rollback: sync-service is deployable independently; a bad lift deploy rolls
  back alone. Kernel plane rolls back with the kernel pin (ADR-014).

## Operational consequences

- Two CRDT runtimes to operate and observe (Loro WASM worker + kernel Yjs);
  per-plane metrics (session counts, update sizes, draft counts).
- Upgrade coupling: sync-service is in-repo and pinned; kernel plane moves
  with the submodule pin only.

## Tests and acceptance

- Kernel trio contract tests (from the 182-ledger): draft update → finalize →
  merge with `includeDraft`; revert erases; replay reconstructs branch state
  via `draftUpdate` replay before `ready()`.
- Lifted sync-service smoke: two clients converge on one doc through the
  wrapper mount; reconnect resumes; receipt revocation closes sessions per
  policy.
- Extraction bridge: doc edit → search text extraction → indexed (ADR-007
  freshness SLO).

## Follow-up decisions

- **OD-13 (new)**: ratify the two-plane posture (and its corollary: no
  Loro↔Yjs convergence work in pass 1); decide the sync-session
  revocation-latency policy.
- Documents content-location details and annotation/threads coupling belong
  to `reports/04-target-architecture-decisions.md` (documents domain).
