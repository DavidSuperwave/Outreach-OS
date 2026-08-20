import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { parse } from "jsonc-parser";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validateConfig } from "./deploy.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("committed deployment.jsonc still contains placeholders and must fail validateConfig", async () => {
  const config = parse(await readFile(join(root, "deployment.jsonc"), "utf8"));
  assert.match(config.accountId, /^<.+>$/);
  assert.throws(() => validateConfig(config), /placeholder/i);
});

test("pnpm check / deploy.mjs --check fails on committed placeholders without touching Cloudflare", () => {
  const result = spawnSync(process.execPath, ["scripts/deploy.mjs", "--check"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(output, /placeholder/i);
  assert.doesNotMatch(output, /wrangler/i);
});
