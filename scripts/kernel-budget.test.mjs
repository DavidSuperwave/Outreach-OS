import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { checkKernelBudget } from "./governance/kernel-budget.mjs";
import { API_TS_SHA256, KERNEL_PIN } from "./governance/pins.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("kernel gitlink, checkout, api.ts hash, and patch budget match ADR-014", () => {
  const result = checkKernelBudget();
  assert.equal(result.ok, true, result.findings.join("\n"));
  assert.equal(result.pin, KERNEL_PIN);
  assert.equal(result.gitlink, KERNEL_PIN);
  assert.equal(result.checkedOut, KERNEL_PIN);
  assert.equal(result.apiSha256, API_TS_SHA256);
  assert.deepEqual(result.carriedPatches, []);
});

test("Node 24 is declared in engines and .nvmrc (OD-26)", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.equal(pkg.engines.node, ">=24 <25");
  assert.equal(pkg.engines.pnpm, ">=11 <12");
  assert.equal(readFileSync(join(root, ".nvmrc"), "utf8").trim(), "24");
  const [major] = process.versions.node.split(".");
  assert.equal(major, "24", `running Node ${process.versions.node}, expected 24.x`);
});
