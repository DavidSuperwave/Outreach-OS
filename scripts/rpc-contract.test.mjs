import assert from "node:assert/strict";
import test from "node:test";
import {
  ANONYMOUS_CALLBACK_ROW,
  NON_CALLABLE_CONTRACT_EXPORTS,
  RPC_CAPABILITY_COUNT,
} from "./governance/pins.mjs";
import { checkRpcContract, loadRpcContract } from "./governance/rpc-contract.mjs";

test("frozen 182-capability RPC ledger matches pinned api.ts", () => {
  const loaded = loadRpcContract();
  const result = checkRpcContract(loaded);
  assert.equal(result.ok, true, result.findings.join("\n"));
  assert.equal(result.count, RPC_CAPABILITY_COUNT);
  assert.equal(result.parsedCount, RPC_CAPABILITY_COUNT);
  assert.ok(
    loaded.ledgerRows.some(
      (row) => `${row.interface_or_capability}.${row.method}` === ANONYMOUS_CALLBACK_ROW,
    ),
    `missing ${ANONYMOUS_CALLBACK_ROW}`,
  );
});

test("contract:req-resp harness is bootstrapped for every ledger row in that class", () => {
  const result = checkRpcContract();
  assert.equal(result.reqResp.length, 130);
  for (const id of result.reqResp) {
    assert.match(id, /^[A-Za-z]+\.[A-Za-z][A-Za-z0-9.]*$/);
  }
});

test("non-callable wire contract from wp020 §5 is exported by api.ts", () => {
  const { exports } = loadRpcContract();
  for (const name of NON_CALLABLE_CONTRACT_EXPORTS) {
    assert.equal(exports.has(name), true, `missing export ${name}`);
  }
});
