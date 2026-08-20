# Neuwave rewrite package instructions

Read `00-START-HERE.md` and the assigned Linear issue before work.

Authority: current owner rulings → code at verified pins → generated contracts/migrations → verified audits → planning prose.

Outreach OS is the implementation baseline. Neuwave is the behavior/UI/compatibility reference. Rewrite from scratch in Cloudflare-native TypeScript/React; do not copy Rust code or Macro branding/assets.

Wave-1 verification and planning is complete and lives in `docs/neuwave-rewrite/`. Product implementation is authorized per Linear issue (start at SUP-547 / N0). Stay inside the assigned issue's boundary; do not re-litigate owner rulings. Deploys and secret operations still require separate instruction.

Every material output must include source evidence, state owner, authorization, failure/retry model, compatibility impact, tests/parity, migration, rollback, and open decisions.
