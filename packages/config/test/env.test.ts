import assert from "node:assert/strict";
import test from "node:test";
import { loadEnv, loadPublicEnv, socialAvailability, systemStatus } from "../src/index.ts";

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

test("loadPublicEnv never copies server secrets", () => {
  const pub = loadPublicEnv({
    AI_API_KEY: "sk-secret",
    DATABASE_URL: "postgres://secret",
    X_BEARER_TOKEN: "bearer-secret",
    RPC_URL: "https://secret-rpc.example/key",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  });
  const blob = JSON.stringify(pub);
  assert.equal(blob.includes("sk-secret"), false);
  assert.equal(blob.includes("postgres://secret"), false);
  assert.equal(blob.includes("bearer-secret"), false);
  assert.equal(blob.includes("secret-rpc"), false);
});

test("address and indexer aliases are accepted", () => {
  const cfg = loadEnv({
    UNISWAP_POOL_MANAGER_ADDRESS: "0x1111111111111111111111111111111111111111",
    INDEXER_START_BLOCK: "42",
    INDEXER_POLL_INTERVAL: "9000",
  });
  assert.equal(cfg.uniswap.poolManager, "0x1111111111111111111111111111111111111111");
  assert.equal(cfg.indexer.startBlock, 42);
  assert.equal(cfg.indexer.intervalMs, 9000);
});

test("invalid values are listed without inventing working config", () => {
  const cfg = loadEnv({
    CHAIN_ID: "abc",
    LAUNCH_FACTORY_ADDRESS: "not-an-address",
  });
  assert.ok(cfg.invalid.includes("CHAIN_ID"));
  assert.ok(cfg.invalid.includes("LAUNCH_FACTORY_ADDRESS"));
  assert.equal(cfg.chainId, null);
  assert.equal(cfg.launchFactory, "not-an-address");
});
