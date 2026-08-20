import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { INSTANTLY_FORBIDDEN_METHODS } from "connectivity";
import { ownerOf } from "control-plane";
import {
  REQUIRED_DOMAIN_PACKAGES,
  REQUIRED_STORAGE_OWNERS,
  SEARCH_COVERAGE_TYPES,
  SEED_ENTITIES,
  SEED_TEAM,
  SEED_USER,
} from "./catalog.js";
import { dryRunAllDomains } from "./mapping.js";

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
    expect(new Set(rows.map((row) => row.domain)).size).toBeGreaterThanOrEqual(6);
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
});
