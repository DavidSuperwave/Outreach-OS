# Definition of done

## Planning phase is done when

- Repository and source pins are verified.
- The closed ledger is identified and all explicit verdicts are traceable.
- Every audit and inventory has a coverage statement.
- RPC and command/hotkey ledgers are exact enough for manual review.
- All premise-breaking facts are escalated.
- Target architecture ADRs are accepted.
- The dependency/build graph exists.
- A representative vertical slice is selected.

## A domain is implementation-complete when

- User journeys and invariants are implemented.
- State authority and storage are documented.
- Authorization matrix passes.
- API/RPC and command compatibility rows are resolved.
- Async flows are idempotent, observable, and replayable.
- Projections reconcile from authority.
- UI interaction/accessibility/visual parity gates pass.
- Migration and rollback are tested.
- Runbooks, alerts, and ownership exist.
- Intentional differences are owner-approved.

## Product rewrite is done when

- Every kept ledger row maps to a shipped implementation or an owner-approved deferral.
- Every explicit kill/replacement is absent and tested as such.
- Data is migrated and reconciled.
- Production traffic is cut over with tested rollback.
- Legacy writes are disabled and old systems are decommissioned according to retention policy.
- The new repo contains living architecture, compatibility, migration, and operator documentation.
- A future agent can understand the system without relying on this chat.
