# Codex implementation-wave prompt template

Use only after WP-000 through WP-030 are accepted.

```text
Implement work packet <WP-ID> in the current repository.

Before changing code:
- read root/nested AGENTS.md;
- read the accepted domain spec, ADRs, compatibility rows, and parity rows;
- inspect git status and preserve unrelated work;
- restate the state owner, authorization boundary, migration impact, and rollback.

Implementation constraints:
- change only the files required by this packet;
- add contract, authorization, failure/retry, and parity tests with the implementation;
- do not add a second authority or bypass the event/outbox/projection rules;
- do not alter accepted RPC/command compatibility without updating the ledger;
- do not deploy, push, commit, or open a PR unless separately instructed.

At completion report:
- files changed;
- behavior implemented;
- source/ruling traceability;
- tests run and results;
- remaining parity gaps;
- migration/backfill needs;
- operational risks and rollback;
- any owner decision needed.
```
