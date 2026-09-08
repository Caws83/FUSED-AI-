import assert from "node:assert/strict";
import test from "node:test";
import { loadEnv, systemStatus } from "@fused-ai/config";
import { operationalDexVersions } from "@fused-ai/blockchain";

test("status page data contains no operational DEX without contracts", () => {
  const status = systemStatus(loadEnv({}));
  assert.notEqual(status.social.status, "OK");
  assert.notEqual(status.ai.status, "OK");
  assert.deepEqual(operationalDexVersions(loadEnv({})), []);
});
