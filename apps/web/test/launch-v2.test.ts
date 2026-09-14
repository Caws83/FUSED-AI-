import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ROBINHOOD_TESTNET_LAUNCH_V1, ROBINHOOD_TESTNET_LAUNCH_V2 } from "@fused-ai/config";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("manual launch, Fuse-a-Post, and launch sync create through FusedFactoryV2", () => {
  const launchPage = readFileSync(join(root, "src/app/launch/page.tsx"), "utf8");
  const manual = readFileSync(join(root, "src/components/ManualLaunch.tsx"), "utf8");
  const fuse = readFileSync(join(root, "src/components/FusePost.tsx"), "utf8");
  const sync = readFileSync(join(root, "src/app/api/launch/sync/route.ts"), "utf8");
  assert.match(launchPage, /defaultLaunchGeneration/);
  assert.match(manual, /functionName:\s*"create"/);
  assert.match(manual, /FUSED_FACTORY_ABI/);
  assert.match(fuse, /applyFusedDraft|FusedDraft/);
  assert.equal(fuse.includes("writeContract"), false);
  assert.match(sync, /isKnownLaunchFactory/);
  assert.match(sync, /generationForFactory/);
  assert.equal(sync.includes("env.launchFactory as Hex"), false);
});

test("buy and sell route to the token factory, not the default factory", () => {
  const tokenPage = readFileSync(join(root, "src/app/token/[address]/page.tsx"), "utf8");
  const trade = readFileSync(join(root, "src/components/TradePanel.tsx"), "utf8");
  const live = readFileSync(join(root, "src/app/api/token/[address]/live/route.ts"), "utf8");
  const launches = readFileSync(join(root, "src/lib/launches.ts"), "utf8");
  assert.match(tokenPage, /tradeFactoryAddress/);
  assert.equal(tokenPage.includes("env.launchFactory"), false);
  assert.match(trade, /functionName:\s*"buy"/);
  assert.match(trade, /functionName:\s*"sell"/);
  assert.match(trade, /expectedChainId/);
  assert.match(trade, /writeClientError\("chain"\)/);
  assert.match(live, /readMarketOnFactories/);
  assert.match(launches, /tradeFactoryForLaunch/);
  assert.match(launches, /indexedLaunchFactories/);
});

test("known testnet factory addresses stay split between v1 and v2", () => {
  assert.equal(ROBINHOOD_TESTNET_LAUNCH_V2.factory, "0x359b3D82d958488eA9177c0F56EB3558ba59a40B");
  assert.equal(ROBINHOOD_TESTNET_LAUNCH_V1.factory, "0x42654079a991EE21e2d2f7Eed0A77bf6a0082208");
  assert.notEqual(ROBINHOOD_TESTNET_LAUNCH_V1.factory.toLowerCase(), ROBINHOOD_TESTNET_LAUNCH_V2.factory.toLowerCase());
});
