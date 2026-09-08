import assert from "node:assert/strict";
import test from "node:test";
import { loadEnv, socialAvailability, systemStatus } from "../src/index.ts";

test("empty env reports NOT_CONFIGURED rather than inventing values", () => {
  const cfg = loadEnv({});
  assert.equal(cfg.databaseUrl, null);
  assert.equal(cfg.launchFactory, null);
  assert.equal(cfg.ai.provider, null);
  const social = socialAvailability(cfg);
  assert.equal(social.status, "NOT_CONFIGURED");
});

test("systemStatus never marks launch contracts OK without addresses", () => {
  const status = systemStatus(loadEnv({}));
  assert.equal(status.launchContracts.status, "CONTRACTS_NOT_DEPLOYED");
  assert.equal(status.indexer.status, "NOT_CONFIGURED");
  assert.equal(status.wallet.status, "NOT_CONFIGURED");
  assert.equal(status.tokenizedAssetRegistry.status, "NOT_CONFIGURED");
});
