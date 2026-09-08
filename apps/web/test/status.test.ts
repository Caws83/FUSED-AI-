import assert from "node:assert/strict";
import test from "node:test";
import { loadEnv, systemStatus } from "@fused-ai/config";
import { operationalDexVersions } from "@fused-ai/blockchain";
import { toDisplayStatus } from "../src/lib/status.ts";

test("status page data contains no operational DEX without contracts", () => {
  const status = systemStatus(loadEnv({}));
  assert.notEqual(status.social.status, "OK");
  assert.notEqual(status.ai.status, "OK");
  assert.equal(status.indexer.status, "NOT_CONFIGURED");
  assert.equal(status.wallet.status, "NOT_CONFIGURED");
  assert.deepEqual(operationalDexVersions(loadEnv({})), []);
});

test("availability labels never map missing deps to READY", () => {
  assert.equal(toDisplayStatus("OK"), "READY");
  assert.equal(toDisplayStatus("NOT_CONFIGURED"), "NOT_CONFIGURED");
  assert.equal(toDisplayStatus("CONTRACTS_NOT_DEPLOYED"), "NOT_DEPLOYED");
  assert.equal(toDisplayStatus("ADAPTER_NOT_IMPLEMENTED"), "PLANNED");
  assert.equal(toDisplayStatus("PROVIDER_UNAVAILABLE"), "UNAVAILABLE");
});
