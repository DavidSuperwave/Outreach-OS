import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { INSTANTLY_FORBIDDEN_METHODS } from "connectivity";
import { STORAGE_OWNERS, ownerOf } from "control-plane";
import { PATH_ROUTES, KERNEL_RPC_TOTAL as SHELL_KERNEL_RPC_TOTAL } from "shell";
import {
  REQUIRED_DOMAIN_PACKAGES,
  REQUIRED_STORAGE_OWNERS,
  SEARCH_COVERAGE_TYPES,
  SEED_ENTITIES,
  SEED_TEAM,
  SEED_USER,
} from "./catalog.js";
import {
  AGENT_DEPLOY_ALLOWED,
  BRANCH_A_DATA_MIGRATION,
  BRANCH_A_DECOMMISSION_LEGACY_DATA,
  BRANCH_A_DUAL_RUN,
  CUTOVER_HUMAN_LEFTOVERS,
  KERNEL_PIN,
  KERNEL_RPC_TOTAL,
  N19_FORBIDDEN_CHROME,
  N19_PARKED,
  N19_PARKED_ROUTES,
  ROLLBACK_STRATEGY,
} from "./cutover.js";
import { dryRunAllDomains } from "./mapping.js";
import { DOMAIN_RELEASE_SIGNOFF, RELEASE_GATE_IDS, signedGateIds } from "./release-gates.js";
import {
  EMAIL_LIVE_TABLE_COUNT,
  HARVESTED_SCHEMA_FAMILIES,
  SCHEMA_REFERENCE_DROPPED_TABLES,
  SCHEMA_REFERENCE_LIVE_TABLE_COUNT,
  harvestedPostgresTables,
  unmappedLiveTableRemainder,
} from "./schema-reference.js";

const ROOT = join(fileURLToPath(new URL("../../..", import.meta.url)));

describe("N20 Branch A seed fixtures", () => {
  it("names the Intraplex demo catalog without writing authorities", () => {
    expect(SEED_TEAM).toMatch(/^team_/);
    expect(SEED_USER).toMatch(/^usr_/);
    expect(SEED_ENTITIES.map((row) => row.entityType)).toEqual([
      "document",
      "project",
      "channel",
      "email_thread",
      "crm_company",
      "crm_contact",
      "calendar_event",
      "call",
      "static_file",
    ]);
    expect(SEARCH_COVERAGE_TYPES).toHaveLength(7);
  });

  it("identity-maps harvested tables with wrote:false (OD-1)", () => {
    const rows = dryRunAllDomains();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.wrote === false)).toBe(true);
    expect(new Set(rows.map((row) => row.domain)).size).toBe(Object.keys(HARVESTED_SCHEMA_FAMILIES).length);
  });
});

describe("N20 schema-reference census (194 live tables)", () => {
  it("freezes the corrected live/dropped/email counts from 01 I2/I3", () => {
    expect(SCHEMA_REFERENCE_LIVE_TABLE_COUNT).toBe(194);
    expect(SCHEMA_REFERENCE_DROPPED_TABLES).toHaveLength(8);
    expect(HARVESTED_SCHEMA_FAMILIES.mailbox).toHaveLength(EMAIL_LIVE_TABLE_COUNT);
    expect(HARVESTED_SCHEMA_FAMILIES.documents).toHaveLength(15);
  });

  it("aggregates per-domain harvested tables and does not map dropped names", () => {
    const postgres = harvestedPostgresTables();
    expect(postgres.length).toBeGreaterThan(0);
    expect(postgres).toContain("documents");
    expect(postgres).toContain("email_threads");
    expect(postgres).not.toContain("static_files");
    for (const dropped of SCHEMA_REFERENCE_DROPPED_TABLES) {
      expect(postgres).not.toContain(dropped);
    }
    const remainder = unmappedLiveTableRemainder();
    expect(remainder).toBe(SCHEMA_REFERENCE_LIVE_TABLE_COUNT - postgres.length);
    expect(remainder).toBeGreaterThan(0);
  });
});

describe("N21 Branch A cutover checklist", () => {
  it("keeps Instantly send/activate/start closed", () => {
    expect(INSTANTLY_FORBIDDEN_METHODS).toEqual(expect.arrayContaining(["send", "activate", "start"]));
  });

  it("has every Wave 2–4c domain package on disk", () => {
    for (const name of REQUIRED_DOMAIN_PACKAGES) {
      expect(existsSync(join(ROOT, "packages", name, "package.json")), name).toBe(true);
    }
  });

  it("registers Wave 4 storage owner rows", () => {
    for (const name of REQUIRED_STORAGE_OWNERS) {
      expect(ownerOf(name).name).toBe(name);
    }
  });

  it("signs every 09 release gate across kept domain packages", () => {
    expect(DOMAIN_RELEASE_SIGNOFF.map((row) => row.pkg).sort()).toEqual([...REQUIRED_DOMAIN_PACKAGES].sort());
    expect(signedGateIds()).toEqual([...RELEASE_GATE_IDS]);
    expect(STORAGE_OWNERS.length).toBeGreaterThan(0);
  });

  it("keeps Branch A cutover light: no dual-run, no data migration, no agent deploy", () => {
    expect(BRANCH_A_DATA_MIGRATION).toBe(false);
    expect(BRANCH_A_DUAL_RUN).toBe(false);
    expect(BRANCH_A_DECOMMISSION_LEGACY_DATA).toBe(false);
    expect(AGENT_DEPLOY_ALLOWED).toBe(false);
    expect(ROLLBACK_STRATEGY).toBe("previous-worker-and-seed");
    expect(CUTOVER_HUMAN_LEFTOVERS).toEqual(
      expect.arrayContaining(["pnpm deploy with David's explicit go", "production DNS / switch-on"]),
    );
    const deployment = readFileSync(join(ROOT, "deployment.jsonc"), "utf8");
    expect(deployment).toContain("<CLOUDFLARE_ACCOUNT_ID>");
  });

  it("asserts the kernel pin is pristine and the RPC freeze is 182", () => {
    expect(KERNEL_RPC_TOTAL).toBe(182);
    expect(SHELL_KERNEL_RPC_TOTAL).toBe(182);
    const head = execFileSync("git", ["-C", join(ROOT, "cloudflare-os"), "rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
    expect(head).toBe(KERNEL_PIN);
    const dirty = execFileSync("git", ["-C", join(ROOT, "cloudflare-os"), "status", "--porcelain"], {
      encoding: "utf8",
    }).trim();
    expect(dirty).toBe("");
  });
});

describe("N19 parked business chrome", () => {
  it("keeps onboarding routes in the 27-route map without paywall chrome", () => {
    expect(N19_PARKED).toBe(true);
    for (const route of N19_PARKED_ROUTES) {
      expect(PATH_ROUTES).toContain(route);
    }
    expect(N19_FORBIDDEN_CHROME).toEqual(["paywall", "tutorialComplete", "billing"]);
  });
});
