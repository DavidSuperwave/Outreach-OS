import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseCsv } from "./csv.mjs";
import { exportedNames, parseApiCapabilities } from "./parse-api.mjs";
import {
  ANONYMOUS_CALLBACK_ROW,
  API_TS_RELATIVE,
  KERNEL_SUBMODULE_PATH,
  NON_CALLABLE_CONTRACT_EXPORTS,
  RPC_CAPABILITY_COUNT,
  RPC_LEDGER_RELATIVE,
  RPC_LEDGER_SHA256,
  KERNEL_PIN,
} from "./pins.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function ledgerId(row) {
  return `${row.interface_or_capability}.${row.method}`;
}

export function loadRpcContract() {
  const apiPath = join(root, KERNEL_SUBMODULE_PATH, API_TS_RELATIVE);
  const ledgerPath = join(root, RPC_LEDGER_RELATIVE);
  const apiText = readFileSync(apiPath, "utf8");
  const ledgerText = readFileSync(ledgerPath, "utf8");
  return {
    apiText,
    ledgerRows: parseCsv(ledgerText),
    parsed: parseApiCapabilities(apiText),
    exports: exportedNames(apiText),
    ledgerSha256: sha256File(ledgerPath),
  };
}

export function checkRpcContract(loaded = loadRpcContract()) {
  const findings = [];
  const { ledgerRows, parsed, exports, ledgerSha256 } = loaded;

  if (ledgerSha256 !== RPC_LEDGER_SHA256) {
    findings.push(
      `RPC ledger sha256 is ${ledgerSha256}, frozen hash is ${RPC_LEDGER_SHA256}. Ledger edits need a compatibility note (06-COMPAT freeze rule).`,
    );
  }

  if (ledgerRows.length !== RPC_CAPABILITY_COUNT) {
    findings.push(
      `ledger has ${ledgerRows.length} rows, freeze is ${RPC_CAPABILITY_COUNT}.`,
    );
  }
  if (parsed.length !== RPC_CAPABILITY_COUNT) {
    findings.push(
      `api.ts parse produced ${parsed.length} capabilities, freeze is ${RPC_CAPABILITY_COUNT}.`,
    );
  }

  const ledgerIds = new Set(ledgerRows.map(ledgerId));
  const parsedIds = new Set(parsed.map((row) => row.id));

  for (const id of [...parsedIds].sort()) {
    if (!ledgerIds.has(id)) findings.push(`api.ts capability missing from ledger: ${id}`);
  }
  for (const id of [...ledgerIds].sort()) {
    if (!parsedIds.has(id)) findings.push(`ledger row missing from api.ts parse: ${id}`);
  }

  const wrongPin = ledgerRows.filter((row) => row.source_pin !== KERNEL_PIN);
  if (wrongPin.length) {
    findings.push(`${wrongPin.length} ledger rows do not cite kernel pin ${KERNEL_PIN}.`);
  }

  if (!ledgerIds.has(ANONYMOUS_CALLBACK_ROW)) {
    findings.push(`ledger is missing anonymous callback row ${ANONYMOUS_CALLBACK_ROW}.`);
  }

  for (const name of NON_CALLABLE_CONTRACT_EXPORTS) {
    if (!exports.has(name)) {
      findings.push(`non-callable wire export missing from api.ts: ${name}`);
    }
  }

  const byClass = new Map();
  for (const row of ledgerRows) {
    const testClass = row.contract_or_parity_test.split("+")[0].trim();
    if (!byClass.has(testClass)) byClass.set(testClass, []);
    byClass.get(testClass).push(ledgerId(row));
  }

  return {
    ok: findings.length === 0,
    findings,
    count: ledgerRows.length,
    parsedCount: parsed.length,
    byClass,
    reqResp: byClass.get("contract:req-resp") ?? [],
  };
}

function report(result) {
  const classLines = [...result.byClass.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, rows]) => `  ${name}: ${rows.length}`);
  const lines = [
    `ledger rows:  ${result.count}`,
    `parsed rows:  ${result.parsedCount}`,
    `req-resp:     ${result.reqResp.length} (harness bootstrapped)`,
    "test classes:",
    ...classLines,
    `status:       ${result.ok ? "PASS" : "FAIL"}`,
  ];
  if (!result.ok) {
    lines.push("", "findings:");
    for (const finding of result.findings) lines.push(`- ${finding}`);
  }
  return lines.join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = checkRpcContract();
  console.log(report(result));
  if (!result.ok) process.exitCode = 1;
}
