import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { extractPermit2Bytecode, permit2DeploySourcePath } from "./etch-permit2.mjs";
import { parseForgeLabels } from "./write-local-env.mjs";
import { PERMIT2 } from "./anvil-account.mjs";

test("parseForgeLabels reads forge console2 addresses", () => {
  const labels = parseForgeLabels(`
    poolManager 0x5FbDB2315678afecb367f032d93F642f64180aa3
    permit2 0x000000000022D473030F116dDEE9F6B43aC78BA3
    positionManager 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
    launchFactory 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
    launchLocker 0x75537828f2ce51be7289709686A69CbFDbB714F1
    deployBlock 4
  `);
  assert.equal(labels.launchFactory, "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0");
  assert.equal(labels.permit2, PERMIT2);
  assert.equal(labels.deployBlock, "4");
});

test("Permit2 bytecode is extracted from official Uniswap DeployPermit2", () => {
  const bytecode = extractPermit2Bytecode(readFileSync(permit2DeploySourcePath(), "utf8"));
  assert.match(bytecode, /^0x6040/);
  assert.ok(bytecode.length > 10_000);
});
