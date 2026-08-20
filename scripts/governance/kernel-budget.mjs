import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  API_TS_RELATIVE,
  API_TS_SHA256,
  KERNEL_PIN,
  KERNEL_SUBMODULE_PATH,
} from "./pins.mjs";

const root = resolveRoot(fileURLToPath(import.meta.url));

function resolveRoot(fromFile) {
  return join(dirname(fromFile), "../..");
}

function git(args, cwd = root) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed (${result.status}): ${result.stderr || result.stdout}`,
    );
  }
  return (result.stdout || "").trim();
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function patchFiles() {
  const dir = join(root, "patches");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => name.endsWith(".patch")).sort();
}

/**
 * ADR-014 kernel-change budget: gitlink == pin, submodule pristine, no
 * unadmitted patches, api.ts hash frozen.
 */
export function checkKernelBudget() {
  const findings = [];
  const submodule = join(root, KERNEL_SUBMODULE_PATH);
  if (!existsSync(join(submodule, "package.json"))) {
    findings.push("cloudflare-os submodule is not initialized. Run git submodule update --init.");
    return { ok: false, findings, pin: KERNEL_PIN };
  }

  const gitlink = git(["ls-tree", "HEAD", KERNEL_SUBMODULE_PATH]);
  const gitlinkSha = gitlink.split(/\s+/)[2];
  if (gitlinkSha !== KERNEL_PIN) {
    findings.push(
      `gitlink is ${gitlinkSha}, expected kernel pin ${KERNEL_PIN}. Pin bumps are ADR-014 events.`,
    );
  }

  const checkedOut = git(["rev-parse", "HEAD"], submodule);
  if (checkedOut !== KERNEL_PIN) {
    findings.push(
      `checked-out submodule HEAD is ${checkedOut}, expected ${KERNEL_PIN}.`,
    );
  }

  const dirty = git(["status", "--porcelain"], submodule);
  if (dirty) {
    findings.push(
      `submodule worktree is not pristine:\n${dirty}\nKernel diffs require an admitted patch + ADR.`,
    );
  }

  const apiPath = join(submodule, API_TS_RELATIVE);
  if (!existsSync(apiPath)) {
    findings.push(`missing ${KERNEL_SUBMODULE_PATH}/${API_TS_RELATIVE}`);
  } else {
    const hash = sha256File(apiPath);
    if (hash !== API_TS_SHA256) {
      findings.push(
        `api.ts sha256 is ${hash}, frozen hash is ${API_TS_SHA256}. Surface diffs need a ledger update and ADR-002/014.`,
      );
    }
  }

  const patches = patchFiles();
  const statusPath = join(root, "KERNEL-STATUS.md");
  const statusText = existsSync(statusPath) ? readFileSync(statusPath, "utf8") : "";
  if (!statusText.includes(KERNEL_PIN)) {
    findings.push("KERNEL-STATUS.md must cite the current kernel pin.");
  }
  if (patches.length) {
    for (const name of patches) {
      const body = readFileSync(join(root, "patches", name), "utf8");
      if (!/\bADR-0\d{2}\b/.test(body) && !/\bADR-\d{3}\b/.test(body)) {
        findings.push(
          `patches/${name} has no ADR reference. ADR-014 admits a patch only with an ADR + upgrade-cost estimate.`,
        );
      }
      if (!statusText.includes(name)) {
        findings.push(`patches/${name} is not listed in KERNEL-STATUS.md.`);
      }
    }
  }

  return {
    ok: findings.length === 0,
    findings,
    pin: KERNEL_PIN,
    gitlink: gitlinkSha,
    checkedOut,
    apiSha256: existsSync(apiPath) ? sha256File(apiPath) : null,
    carriedPatches: patches,
    root: relative(process.cwd(), root) || ".",
  };
}

function report(result) {
  const lines = [
    `kernel pin:     ${result.pin}`,
    `gitlink:        ${result.gitlink}`,
    `checked out:    ${result.checkedOut}`,
    `api.ts sha256:  ${result.apiSha256}`,
    `carried patches: ${result.carriedPatches.length ? result.carriedPatches.join(", ") : "(none)"}`,
    `status:         ${result.ok ? "PASS" : "FAIL"}`,
  ];
  if (!result.ok) {
    lines.push("", "findings:");
    for (const finding of result.findings) lines.push(`- ${finding}`);
  }
  return lines.join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = checkKernelBudget();
  console.log(report(result));
  if (!result.ok) process.exitCode = 1;
}
