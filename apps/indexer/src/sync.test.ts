import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { uniqueFactories, resumeFromBlock, chunkBlockRange } from "./sync.ts";

test("multi-factory indexer uses per-factory cursors and log.address as factory", () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "sync.ts"), "utf8");
  assert.match(src, /indexedLaunchFactories/);
  assert.match(src, /getFactoryCursor/);
  assert.match(src, /setFactoryCursor/);
  assert.match(src, /log\.address/);
  assert.match(src, /uniqueFactories/);
  assert.equal(src.includes("factory: env.launchFactory"), false);
  assert.match(src, /119313128|deployBlock/);
});

test("duplicate factory addresses collapse to one poll target", () => {
  const once = uniqueFactories([
    { version: "v1", factory: "0x42654079a991EE21e2d2f7Eed0A77bf6a0082208", locker: null, deployBlock: 117433209 },
    { version: "v1", factory: "0x42654079a991EE21e2d2f7Eed0A77bf6a0082208", locker: null, deployBlock: 117433209 },
    { version: "v2", factory: "0x359b3D82d958488eA9177c0F56EB3558ba59a40B", locker: null, deployBlock: 119313128 },
  ]);
  assert.equal(once.length, 2);
});

test("V2 resume starts at the V2 deploy block, not the chain head", () => {
  const from = resumeFromBlock(119313128n, null, 50n);
  assert.equal(from, 119313128n);
  const v1 = resumeFromBlock(117433209n, 119400000n, 50n);
  assert.equal(v1, 119399950n);
  const chunks = chunkBlockRange(119313128n, 119315128n, 2000n);
  assert.equal(chunks[0]?.from, 119313128n);
});

test("Arc indexer starts at the factory deploy block and never fabricates Graduated", () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "sync.ts"), "utf8");
  assert.match(src, /GraduationReady/);
  assert.match(src, /FeeAccrued/);
  assert.match(src, /Claimed/);
  assert.match(src, /ARC_TESTNET_CHAIN_ID/);
  assert.match(src, /FUSED_FACTORY_INDEXER_ABI/);
  const from = resumeFromBlock(62246396n, null, 50n);
  assert.equal(from, 62246396n);
});
