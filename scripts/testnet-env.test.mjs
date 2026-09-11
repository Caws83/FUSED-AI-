import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ANVIL_ACCOUNT_0 } from "./anvil-account.mjs";
import { isAnvilPrivateKey, looksLikePrivateKey } from "./anvil-keys.mjs";
import { repoRoot } from "./repo-env.mjs";

test("well-known Anvil keys are detected without printing them", () => {
  assert.equal(isAnvilPrivateKey(ANVIL_ACCOUNT_0.privateKey), true);
  assert.equal(isAnvilPrivateKey(""), false);
  assert.equal(looksLikePrivateKey("0x" + "11".repeat(32)), true);
  assert.equal(isAnvilPrivateKey("0x" + "11".repeat(32)), false);
});

test("testnet example JSON does not invent Fused factory addresses", () => {
  const file = path.join(repoRoot(), "deployments", "robinhood-testnet-46630.example.json");
  const row = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(row.chainId, 46630);
  assert.equal(row.status, "NOT_DEPLOYED");
  assert.equal(row.contracts.launchFactory, null);
  assert.equal(row.contracts.launchLocker, null);
  assert.equal(row.deployBlock, null);
  assert.match(row.contracts.poolManager, /^0x[a-fA-F0-9]{40}$/);
  const blob = JSON.stringify(row);
  assert.equal(blob.includes("DEPLOYER_PRIVATE_KEY"), false);
  assert.equal(blob.toLowerCase().includes("ac0974bec39a17d36e8e7151ddb29e79448baab2"), false);
});

test("env:testnet prints public Vercel vars and no secrets", () => {
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--no-warnings", "scripts/print-testnet-env.mjs"],
    { cwd: repoRoot(), encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /NEXT_PUBLIC_CHAIN_ID=46630/);
  assert.match(result.stdout, /NEXT_PUBLIC_RPC_URL=https:\/\/rpc\.testnet\.chain\.robinhood\.com/);
  assert.match(result.stdout, /PUBLIC_LAUNCH_ENABLED=true/);
  assert.match(result.stdout, /LAUNCH_FACTORY_ADDRESS=0x42654079a991EE21e2d2f7Eed0A77bf6a0082208/);
  assert.match(result.stdout, /LAUNCH_LOCKER_ADDRESS=0x68000CD8F3AFE93BB87BeEDc9f2daBbf39E0836b/);
  assert.equal(result.stdout.includes("DEPLOYER_PRIVATE_KEY="), false);
  assert.equal(result.stdout.includes("AI_API_KEY="), false);
  assert.equal(result.stdout.includes("X_BEARER_TOKEN="), false);
  assert.equal(result.stdout.includes("DATABASE_URL="), false);
  assert.equal(result.stdout.includes("AWS_SECRET_ACCESS_KEY="), false);
  assert.equal(result.stdout.toLowerCase().includes("ac0974bec39a17d36e8e7151ddb29e79448baab2"), false);
});
