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

test("loadPublicEnv fills the public Robinhood testnet RPC when chain id is 46630", () => {
  const pub = loadPublicEnv({ NEXT_PUBLIC_CHAIN_ID: "46630" });
  assert.equal(pub.chainId, 46630);
  assert.equal(pub.rpcUrl, "https://rpc.testnet.chain.robinhood.com");
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
  assert.equal(cfg.indexer.maxRangeBlocks, 2000);
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

test("WalletConnect and AI image stay unavailable without ids", () => {
  const status = systemStatus(loadEnv({}));
  assert.equal(status.walletConnect.status, "NOT_CONFIGURED");
  assert.equal(status.aiImage.status, "NOT_CONFIGURED");
  assert.equal(status.media.status, "OK");
});

test("AI image uses existing env names and a dedicated timeout", () => {
  const cfg = loadEnv({
    AI_IMAGE_PROVIDER: "openai",
    AI_IMAGE_API_KEY: "sk-test",
    AI_IMAGE_MODEL: "dall-e-3",
    AI_IMAGE_TIMEOUT_MS: "45000",
  });
  assert.equal(cfg.aiImage.provider, "openai");
  assert.equal(cfg.aiImage.apiKey, "sk-test");
  assert.equal(cfg.aiImage.model, "dall-e-3");
  assert.equal(cfg.aiImage.timeoutMs, 45000);
  assert.equal(systemStatus(cfg).aiImage.status, "OK");
});

test("production rejects local media, localhost RPC/DB, and Anvil factory addresses", () => {
  const status = systemStatus(
    loadEnv({
      NODE_ENV: "production",
      MEDIA_STORE: "local",
      DATABASE_URL: "postgres://fused:fused@127.0.0.1:5432/fused_ai",
      RPC_URL: "http://127.0.0.1:8545",
      NEXT_PUBLIC_RPC_URL: "http://127.0.0.1:8545",
      NEXT_PUBLIC_CHAIN_ID: "4663",
      CHAIN_ID: "4663",
      LAUNCH_FACTORY_ADDRESS: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
      LAUNCH_LOCKER_ADDRESS: "0x75537828f2ce51be7289709686A69CbFDbB714F1",
    }),
  );
  assert.equal(status.media.status, "NOT_CONFIGURED");
  assert.equal(status.database.status, "NOT_CONFIGURED");
  assert.equal(status.rpc.status, "NOT_CONFIGURED");
  assert.equal(status.launchContracts.status, "CONTRACTS_NOT_DEPLOYED");
  assert.equal(status.publicLaunchEnabled, false);
});

test("production website config does not require X, AI, or WalletConnect", () => {
  const cfg = loadEnv({ NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "https://example.vercel.app" });
  const status = systemStatus(cfg);
  assert.equal(status.social.status, "NOT_CONFIGURED");
  assert.equal(status.ai.status, "NOT_CONFIGURED");
  assert.equal(status.aiImage.status, "NOT_CONFIGURED");
  assert.equal(status.walletConnect.status, "NOT_CONFIGURED");
  assert.equal(cfg.publicLaunchEnabled, false);
});

test("tracked-account registry defaults to the repo JSON path", () => {
  const cfg = loadEnv({});
  assert.equal(cfg.social.trackedAccountsPath, "config/tracked-accounts.json");
  assert.equal(systemStatus(cfg).trackedAccounts.status, "OK");
});

test("indexer is OK when database, rpc, and factory are set", () => {
  const status = systemStatus(
    loadEnv({
      DATABASE_URL: "postgres://fused:fused@127.0.0.1:5432/fused_ai",
      RPC_URL: "http://127.0.0.1:8545",
      CHAIN_ID: "31337",
      LAUNCH_FACTORY_ADDRESS: "0x0000000000000000000000000000000000000001",
    }),
  );
  assert.equal(status.indexer.status, "OK");
});

test("manual launch contracts and wallet are OK without AI or X", () => {
  const status = systemStatus(
    loadEnv({
      LAUNCH_FACTORY_ADDRESS: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
      LAUNCH_LOCKER_ADDRESS: "0x75537828f2ce51be7289709686A69CbFDbB714F1",
      CHAIN_ID: "31337",
      RPC_URL: "http://127.0.0.1:8545",
      NEXT_PUBLIC_CHAIN_ID: "31337",
      NEXT_PUBLIC_RPC_URL: "http://127.0.0.1:8545",
    }),
  );
  assert.equal(status.launchContracts.status, "OK");
  assert.equal(status.wallet.status, "OK");
  assert.equal(status.rpc.status, "OK");
  assert.equal(status.social.status, "NOT_CONFIGURED");
  assert.equal(status.ai.status, "NOT_CONFIGURED");
  assert.equal(status.aiImage.status, "NOT_CONFIGURED");
});

test("Vercel cannot use Railway private DNS as DATABASE_URL", () => {
  const cfg = loadEnv({
    VERCEL: "1",
    VERCEL_ENV: "production",
    NODE_ENV: "production",
    DATABASE_URL: "postgres://postgres:x@postgres.railway.internal:5432/railway",
    CHAIN_ID: "46630",
  });
  assert.equal(cfg.databaseUrl, null);
  assert.equal(cfg.invalid.includes("DATABASE_URL"), true);
  assert.equal(systemStatus(cfg).database.status, "NOT_CONFIGURED");
});
