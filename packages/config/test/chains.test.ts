import assert from "node:assert/strict";
import test from "node:test";
import {
  ARC_MAINNET_CHAIN_ID,
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_LAUNCH,
  ROBINHOOD_MAINNET_CHAIN_ID,
  ROBINHOOD_MAINNET_LAUNCH_V2,
  ROBINHOOD_TESTNET_CHAIN_ID,
  ROBINHOOD_TESTNET_LAUNCH_V2,
  launchContractsForChain,
  nativeCurrencyFor,
  newLaunchForWallet,
  parseSupportedChainId,
  rpcUrlForChain,
  WALLET_SELECTOR_CHAIN_IDS,
} from "../src/networks.ts";
import { requirePublicCurveParams } from "../src/curve.ts";
import { mergeChainDeployment, readPublicDeploymentManifest } from "../src/deployment.ts";
import { ARC_TESTNET_CURVE } from "../src/networks.ts";

test("native labels stay ETH on Robinhood and USDC on Arc", () => {
  assert.equal(nativeCurrencyFor(46630).symbol, "ETH");
  assert.equal(nativeCurrencyFor(4663).symbol, "ETH");
  assert.equal(nativeCurrencyFor(5042002).symbol, "USDC");
  assert.equal(nativeCurrencyFor(5042).symbol, "USDC");
  assert.equal(nativeCurrencyFor(5042002).decimals, 18);
});

test("wallet chainId never falls back across Arc and Robinhood", () => {
  const rh = launchContractsForChain(ROBINHOOD_TESTNET_CHAIN_ID);
  const main = launchContractsForChain(ROBINHOOD_MAINNET_CHAIN_ID);
  const arc = launchContractsForChain(ARC_TESTNET_CHAIN_ID);
  const arcMain = launchContractsForChain(ARC_MAINNET_CHAIN_ID);
  assert.equal(rh?.factory, ROBINHOOD_TESTNET_LAUNCH_V2.factory);
  assert.equal(rh?.locker, ROBINHOOD_TESTNET_LAUNCH_V2.locker);
  assert.equal(main?.factory, ROBINHOOD_MAINNET_LAUNCH_V2.factory);
  assert.notEqual(main?.factory, ROBINHOOD_TESTNET_LAUNCH_V2.factory);
  assert.notEqual(arc?.factory, ROBINHOOD_TESTNET_LAUNCH_V2.factory);
  assert.equal(arc?.factory, ARC_TESTNET_LAUNCH.factory);
  assert.equal(arcMain?.deployed, false);
  assert.equal(arcMain?.factory, null);
  assert.equal(launchContractsForChain(1), null);
  assert.equal(launchContractsForChain(8453), null);
  assert.equal(launchContractsForChain(null), null);
});

test("newLaunchForWallet maps supported wallets and fail-closes otherwise", () => {
  const rh = newLaunchForWallet(4663);
  const arc = newLaunchForWallet(5042002);
  assert.equal(rh?.factory, ROBINHOOD_MAINNET_LAUNCH_V2.factory);
  assert.equal(arc?.factory, ARC_TESTNET_LAUNCH.factory);
  assert.notEqual(rh?.factory, arc?.factory);
  assert.equal(newLaunchForWallet(1), null);
  assert.equal(newLaunchForWallet(46630), null);
  assert.equal(newLaunchForWallet(5042), null);
  assert.equal(newLaunchForWallet(null), null);
  assert.deepEqual([...WALLET_SELECTOR_CHAIN_IDS], [4663, 5042002]);
});

test("Arc curve config refuses Robinhood network names and vice versa", () => {
  const mixed = requirePublicCurveParams({
    FUSED_PUBLIC_NETWORK: "robinhood-testnet",
    CHAIN_ID: "5042002",
    FUSED_VIRTUAL_QUOTE_WEI: ARC_TESTNET_CURVE.virtualQuoteWei,
    FUSED_VIRTUAL_TOKEN: ARC_TESTNET_CURVE.virtualToken,
    FUSED_GRADUATION_TARGET_WEI: ARC_TESTNET_CURVE.graduationTargetWei,
    FUSED_FEE_BPS: "100",
    FUSED_LP_FEE: "10000",
  });
  assert.equal(mixed.ok, false);
  const other = requirePublicCurveParams({
    FUSED_PUBLIC_NETWORK: "arc-testnet",
    CHAIN_ID: "46630",
    FUSED_VIRTUAL_QUOTE_WEI: ARC_TESTNET_CURVE.virtualQuoteWei,
    FUSED_VIRTUAL_TOKEN: ARC_TESTNET_CURVE.virtualToken,
    FUSED_GRADUATION_TARGET_WEI: ARC_TESTNET_CURVE.graduationTargetWei,
    FUSED_FEE_BPS: "100",
    FUSED_LP_FEE: "10000",
  });
  assert.equal(other.ok, false);
  const ok = requirePublicCurveParams({
    FUSED_PUBLIC_NETWORK: "arc-testnet",
    CHAIN_ID: String(ARC_TESTNET_CHAIN_ID),
    FUSED_VIRTUAL_QUOTE_WEI: ARC_TESTNET_CURVE.virtualQuoteWei,
    FUSED_VIRTUAL_TOKEN: ARC_TESTNET_CURVE.virtualToken,
    FUSED_GRADUATION_TARGET_WEI: ARC_TESTNET_CURVE.graduationTargetWei,
    FUSED_FEE_BPS: "100",
    FUSED_LP_FEE: "10000",
  });
  assert.equal(ok.ok, true);
  const mainnetTiny = requirePublicCurveParams({
    FUSED_PUBLIC_NETWORK: "arc",
    CHAIN_ID: String(ARC_MAINNET_CHAIN_ID),
    FUSED_VIRTUAL_QUOTE_WEI: "1",
    FUSED_VIRTUAL_TOKEN: "1",
    FUSED_GRADUATION_TARGET_WEI: ARC_TESTNET_CURVE.graduationTargetWei,
    FUSED_FEE_BPS: "100",
    FUSED_LP_FEE: "10000",
  });
  assert.equal(mainnetTiny.ok, false);
});

test("CHAIN_ID 46630 overlay is unchanged and does not read Arc factory", () => {
  const merged = mergeChainDeployment({
    NODE_ENV: "production",
    CHAIN_ID: "46630",
    NEXT_PUBLIC_CHAIN_ID: "46630",
  });
  assert.equal(merged.LAUNCH_FACTORY_ADDRESS, ROBINHOOD_TESTNET_LAUNCH_V2.factory);
  assert.equal(merged.LAUNCH_LOCKER_ADDRESS, ROBINHOOD_TESTNET_LAUNCH_V2.locker);
  const arc = readPublicDeploymentManifest(5042002);
  assert.equal(arc.chainId, 5042002);
  assert.notEqual(arc.contracts.launchFactory, ROBINHOOD_TESTNET_LAUNCH_V2.factory);
});

test("CHAIN_ID 4663 overlay uses mainnet V2 factory and deploy block 64595202", () => {
  const merged = mergeChainDeployment({
    NODE_ENV: "production",
    CHAIN_ID: "4663",
    NEXT_PUBLIC_CHAIN_ID: "4663",
  });
  assert.equal(merged.LAUNCH_FACTORY_ADDRESS, ROBINHOOD_MAINNET_LAUNCH_V2.factory);
  assert.equal(merged.LAUNCH_LOCKER_ADDRESS, ROBINHOOD_MAINNET_LAUNCH_V2.locker);
  assert.equal(merged.LAUNCH_FACTORY_V2_ADDRESS, ROBINHOOD_MAINNET_LAUNCH_V2.factory);
  assert.equal(merged.DEFAULT_LAUNCH_VERSION, "v2");
  assert.equal(merged.INDEXER_START_BLOCK, "64595202");
  assert.equal(merged.LAUNCH_DEPLOY_BLOCK, "64595202");
  assert.notEqual(merged.LAUNCH_FACTORY_ADDRESS, ROBINHOOD_TESTNET_LAUNCH_V2.factory);
});

test("CHAIN_ID 5042002 overlay uses Arc factory and deploy block 62246396", () => {
  const merged = mergeChainDeployment({
    CHAIN_ID: "5042002",
    NEXT_PUBLIC_CHAIN_ID: "5042002",
  });
  assert.equal(merged.LAUNCH_FACTORY_ADDRESS, ARC_TESTNET_LAUNCH.factory);
  assert.equal(merged.LAUNCH_LOCKER_ADDRESS, ARC_TESTNET_LAUNCH.locker);
  assert.equal(merged.INDEXER_START_BLOCK, "62246396");
  assert.equal(merged.LAUNCH_DEPLOY_BLOCK, "62246396");
  assert.notEqual(merged.LAUNCH_FACTORY_ADDRESS, ROBINHOOD_TESTNET_LAUNCH_V2.factory);
});

test("unsupported selector chain ids fail closed", () => {
  assert.equal(parseSupportedChainId("1"), null);
  assert.equal(parseSupportedChainId("4663"), 4663);
  assert.equal(parseSupportedChainId("5042"), 5042);
  assert.equal(parseSupportedChainId(46630), 46630);
  assert.equal(parseSupportedChainId(5042002), 5042002);
  assert.equal(rpcUrlForChain(5042002), "https://rpc.testnet.arc.io");
  assert.equal(rpcUrlForChain(4663), "https://rpc.mainnet.chain.robinhood.com");
  assert.equal(rpcUrlForChain(1), null);
});
