/**
 * N21 Branch A cutover (SUP-568). Light version: no data to migrate, no
 * dual-run store, no automated retention deletion (OD-19). Agent-completable
 * freeze is this checklist. Live DNS / `pnpm deploy` stay human (David's go).
 */

export const BRANCH_A_DATA_MIGRATION = false;
export const BRANCH_A_DUAL_RUN = false;
export const BRANCH_A_DECOMMISSION_LEGACY_DATA = false;
export const AGENT_DEPLOY_ALLOWED = false;

/** Rollback = previous worker + previous seed. There is no dual-run store. */
export const ROLLBACK_STRATEGY = "previous-worker-and-seed" as const;

export const CUTOVER_HUMAN_LEFTOVERS = [
  "fill deployment.jsonc Cloudflare account placeholders",
  "pnpm deploy with David's explicit go",
  "production DNS / switch-on",
  "old-repo archive",
] as const;

export const N19_PARKED = true;
export const N19_PARKED_ROUTES = ["/onboarding", "/getting-started"] as const;
export const N19_FORBIDDEN_CHROME = ["paywall", "tutorialComplete", "billing"] as const;

export const KERNEL_PIN = "bf7f762d7fa73553284d731ab6a978d3ea17be24";
export const KERNEL_RPC_TOTAL = 182;
