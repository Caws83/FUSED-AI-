import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("rewards page reads V2 claimable and claims on the V2 factory", () => {
  const page = readFileSync(join(root, "src/app/rewards/page.tsx"), "utf8");
  const ui = readFileSync(join(root, "src/components/CreatorRewards.tsx"), "utf8");
  const api = readFileSync(join(root, "src/app/api/rewards/creator/route.ts"), "utf8");
  assert.match(page, /CreatorRewards/);
  assert.equal(page.includes("indexedChainId"), false);
  assert.equal(page.includes("defaultLaunchGeneration"), false);
  assert.match(ui, /newLaunchForWallet/);
  assert.match(ui, /FUSED_FACTORY_CLAIM_ABI/);
  assert.match(ui, /functionName:\s*"claimable"/);
  assert.match(ui, /functionName:\s*"claim"/);
  assert.equal(ui.includes("claimFor"), false);
  assert.equal(ui.includes("input"), false);
  assert.equal(ui.toLowerCase().includes("fake"), false);
  assert.equal(ui.includes("locker.claimable"), false);
  assert.match(ui, /paid during collect/);
  assert.match(ui, /writeClientError\("chain"\)/);
  assert.match(ui, /chainId=\$\{chainId\}/);
  assert.match(api, /listLaunchesByLauncher/);
  assert.match(api, /launchContractsForChain/);
  assert.equal(api.includes("env.launch.v2"), false);
  assert.equal(api.includes("claimable"), false);
});
