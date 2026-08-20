# Domain specification — Identity, account, teams (N1 / SUP-548)

## Verdict and source evidence

OD-16: kernel `PublicApi` / `LoginAttempt` / `AdminApi` + User DO adopted directly; no legacy mounts.  
OD-1: fresh start — seed fixtures only. Ledger:181 identity/teams/membership tables = design reference.  
Kernel pin `bf7f762`. Wrapper package: `packages/identity`.

## User journeys

Seeded admin signs in (kernel password auth) and resolves team role `owner` plus deployment-admin.  
Seeded member signs in and resolves team role `member`, not deployment-admin.  
Admin invites a user; invite is single-use; role change is visible on the next check.

## Invariants

One user per kernel username. One effective team role per `(user, team)`, a pure function over the membership projection. Deployment admin is orthogonal (`ADMINS` / `getAdminApi`). Invites single-use. Sessions remain kernel-owned.

## Entities and identifiers

`user`, `team`, `membership`, `invite` with ADR-003 type-tagged TEXT ids (`usr_` / `team_` / `mem_` / `inv_`).

## Authority and consistency

User DO (kernel) = credentials and sessions. TeamAuthority (wrapper Team DO core) = membership, roles, invites. MembershipProjection = derived; TeamAuthority is the sole writer.

## Storage and indexes

Team Durable Object (`TeamDurableObject`) is the N1 authority: SQLite snapshot of membership, invites, and idempotency keys; mutations serialize on the DO. In-memory `TeamAuthority` remains the unit-test core and the DO's load/save engine. D1 `memberships` physical table rides N3/N4 outbox wiring; the projection shape is frozen here.

Kernel User DO remains the credential/session authority (OD-16). Miniflare workers tests import the pinned kernel `UserDurableObject` class (`cloudflare-os/packages/workshop-backend/src/user.ts`) and run `createAccount` / `login` / `authenticate` against it, then bind the session into `DurableTeamsApi`. D1 `memberships` and `/api` composition stay N3/N5.

## RPC/API contract

Kernel `/api` unchanged (28 consumed rows). New wrapper `TeamsApi` (create/invite/accept/role/list/resolveEffectiveRole). Not added to `api.ts`.

## Commands and UI surfaces

None in N1 (0 auth hotkey rows). Kernel LoginPage/SignupPage remain the sign-in UI until N5.

## Authorization matrix

| Actor | list members | invite | set role | mint AdminApi |
|---|---|---|---|---|
| team owner/admin | yes | yes | yes | only if `ADMINS` |
| team member | yes | no | no | no |
| outsider | no | no | no | no |

## Events, jobs, retries, and replay

Team events (`member_added/removed/role_changed/invite_*`) are implied by projection applies. Shared outbox package is N3.

## External providers

Gatekeeper OAuth via kernel `startGatekeeperLogin` / `LoginAttempt`. No FusionAuth.

## Migration and reconciliation

None. Seed fixtures in `src/seed.ts`.

## Tests and parity fixtures

`src/seed-parity.test.ts` (05-MAP row 1, isolation, invites). `src/kernel-auth-surface.test.ts` (28 rows + SERVICE_SALT). `src/kernel-session-protocol.test.ts` + `__tests__/kernel-auth-lifecycle.test.ts` (login/authenticate/revoke + `LoginAttempt.wait` dispose-cancels). `__tests__/team-do.test.ts` (SQLite authority survives eviction).

## Observability/SLOs

Not wired. Role resolution is in-process (immediate).

## Failure modes and rollback

`TeamAuthError` codes. Rollback = revert wrapper package; kernel surface unchanged.

## Open decisions

OD-12(b) `authenticateFromCfAccess` keep-but-disabled until deployment Access posture is chosen.
