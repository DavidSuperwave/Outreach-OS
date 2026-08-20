# Domain specification — Documents + projects / folders (N7 / SUP-555)

## Verdict and source evidence

Wave 4a core domain. OD-18 G1: documents core / annotations / tasks as separate
scopes — this node is **core only** (not annotations, not the OD-7 task facet).
Project = Folder (Q20). 05-MAP row 5: create / edit / version / move / restore
one document and see Soup lists update. OD-1 Branch A: identity-mapping dry run
(`wrote=false`). ADR-008 two CRDT planes named, not implemented. ADR-012 /
OD-8 ConvertedPdf is an interface stub (N15). No kernel patches. No R2 live
uploads.

## User journeys

`c` then `d` opens markdown compose (`create-menu.md`). Create writes an
authoritative document with facet `null` (G1 core), drains the outbox, Soup
lists the row. Edit appends an immutable sha-keyed version. `c` then `f`
creates a folder (`create-menu.project` — Project = Folder). Move places the
document in the folder (`projectId`); Soup `listInFolder` updates. Soft-delete
tombstones the Soup row; restore republishes it. ConvertedPdf may be attached
as a derived location without calling a converter.

## Invariants

No Task entity type; task facet stays N6/N8. Handlers take receipts. Query never
mints. Projection is rebuildable. Duplicate idempotency keys are no-ops. Poison
publishes are marked-and-skipped. Five content locations:
`ObjectStorage`, `SyncService`, `DocxBomParts`, `ConvertedPdf`, `Unknown`
(`crates/documents` enum). Folder entity is registry type `project` (not a
document facet — `DOCUMENT_FACETS` is `task | snippet | skill`). Loro is
sync-service later; kernel Yjs is untouched.

## Entities and identifiers

- `document` (`doc_`) — G1 core; facet `null`.
- `project` (`proj_`) — folder. Project = Folder.
- `document_instance` — version sub-record (sha + location), not a registry type.

## Authority and consistency

In-process `DocumentsSlice` stands in for one DO per document / one DO per
folder. Serialized writes over version creation, folder edges, and the
live → tombstoned (soft-delete) → restore cycle. Purge (registry tombstone)
is later. Concurrent content editors are the Loro sync-service problem (not
this node).

## Storage and indexes

In-process document + folder maps (authority) + N3 outbox + N4
`ProjectionPlane` (lists/search). N3 `STORAGE_OWNERS` rows:
`document_authority`, `folder_edges`. Content is an in-memory handle (no R2).

## RPC/API contract

Typed `DocumentsApi` capability (ADR-002 pattern). Not added to kernel
`api.ts`. No Instantly send/activate methods. `ConvertedPdfPort.attach` never
invokes a converter.

## Commands and UI surfaces

71-row freeze (`canvas` 37 + `md` 32 + `code` 2) named in
`DOCUMENT_COMMAND_IDS`. Parity set exercised here: `create-menu.md`,
`create-menu.project`, `document.edit`, `document.move`, `document.restore`
(plus chrome `create-menu.canvas` / `create-menu.code` / `go-to.documents` and
Soup `soup-entity.rename` / `soup-entity.move-to-folder`). React:
`DocumentWorkspace` / `DocumentComposePopover` / `FolderComposePopover` /
`DocumentList` on Shell path `/documents`.

## Authorization matrix

Document receipts via `document_access` (same mint path as TaskSlice). Folder
receipts via `project_access` (folder inheritance along `parentId`). Share +
revoke hides Soup rows (SEC-1). Cross-tenant mint denies.

## Events, jobs, retries, and replay

Topic `documents` for docs; topic `projects` for folders. Replay from outbox.
Soft-delete publishes `tombstoned: true`; restore republishes the live row.

## External providers

None in N7. ConvertedPdf converter is N15. Sync-service (Loro) is the lift set,
not this wrapper. Instantly is out of scope.

## Migration and reconciliation

OD-1 Branch A: shapes + fixture mapping dry run from legacy `documents` /
`projects` / `document_instance`. No Postgres load. `ConvertedPdf` artifacts
are regenerable (do not migrate).

## Tests and parity fixtures

`packages/documents/src/slice.test.tsx` — mapping dry run, row-5
create/edit/version/move/restore + Soup update, five locations, ConvertedPdf
stub does not invoke converter, live subscription, rebuild+poison, idempotency,
SEC-1, 71-command freeze + parity set including `c`+`d`, SSR surface,
STORAGE_OWNERS rows.

## Observability/SLOs

Version-write and projection lag; extract-failure rate is N15. Content
available SLO waits on R2 (N14).

## Failure modes and rollback

`AuthzError` / missing receipt. Projection rollback = drop +
`rebuildProjection()`. Wrapper rollback = previous package; kernel untouched.

## Open decisions

- **OD-8 / N15** — ConvertedPdf production (LibreOffice container). Stub only.
- **OD-13 / ADR-008** — Loro sync-service lift; two CRDT planes kept.
- Annotations PDF viewer build (G1 annotations row).
- R2 live uploads + folder-upload jobs (N14 / later N7 lift).
- Full 71 editor enablement (canvas/md/code viewers).
