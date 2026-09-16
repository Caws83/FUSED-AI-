import assert from "node:assert/strict";
import test from "node:test";
import { LOCAL_CURVE, PUBLIC_GRADUATION_TARGET_USD, requirePublicCurveParams } from "../src/curve.ts";
import { mergeChainDeployment, parseDeploymentManifest, readPublicDeploymentManifest } from "../src/deployment.ts";
import { isPublicLaunchEnabled } from "../src/features.ts";
import { ROBINHOOD_MAINNET_CURVE, ROBINHOOD_MAINNET_LAUNCH_V2, ROBINHOOD_TESTNET_CURVE, ROBINHOOD_TESTNET_LAUNCH_V2, ROBINHOOD_TESTNET_V4 } from "../src/networks.ts";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

test("local curve stays at 0.1 ETH graduation and is not a public default", () => {
  assert.equal(LOCAL_CURVE.graduationTargetWei, "100000000000000000");
  assert.equal(LOCAL_CURVE.feeBps, 0);
  assert.equal(PUBLIC_GRADUATION_TARGET_USD, 50_000);
});

test("public curve params do not fall back to local 0.1 ETH", () => {
  const missing = requirePublicCurveParams({ CHAIN_ID: "4663", FUSED_PUBLIC_NETWORK: "robinhood" });
  assert.equal(missing.ok, false);
  if (!missing.ok) {
    assert.ok(missing.missing.includes("FUSED_GRADUATION_TARGET_WEI"));
    assert.ok(missing.reason.includes("explicit"));
  }
  const localTarget = requirePublicCurveParams({
    FUSED_PUBLIC_NETWORK: "robinhood",
    CHAIN_ID: "4663",
    FUSED_VIRTUAL_QUOTE_WEI: "1",
    FUSED_VIRTUAL_TOKEN: "1",
    FUSED_GRADUATION_TARGET_WEI: LOCAL_CURVE.graduationTargetWei,
    FUSED_FEE_BPS: "0",
    FUSED_LP_FEE: "10000",
  });
  assert.equal(localTarget.ok, false);
});

test("explicit public curve is accepted when every field is set", () => {
  const ready = requirePublicCurveParams({
    FUSED_PUBLIC_NETWORK: "robinhood",
    CHAIN_ID: "4663",
    FUSED_VIRTUAL_QUOTE_WEI: "123",
    FUSED_VIRTUAL_TOKEN: "456",
    FUSED_GRADUATION_TARGET_WEI: "999000000000000000000",
    FUSED_FEE_BPS: "0",
    FUSED_LP_FEE: "10000",
  });
  assert.equal(ready.ok, true);
});

test("Robinhood testnet accepts explicit 0.01 ETH and refuses local 0.1 ETH", () => {
  const ready = requirePublicCurveParams({
    FUSED_PUBLIC_NETWORK: "robinhood-testnet",
    CHAIN_ID: "46630",
    FUSED_VIRTUAL_QUOTE_WEI: ROBINHOOD_TESTNET_CURVE.virtualQuoteWei,
    FUSED_VIRTUAL_TOKEN: ROBINHOOD_TESTNET_CURVE.virtualToken,
    FUSED_GRADUATION_TARGET_WEI: ROBINHOOD_TESTNET_CURVE.graduationTargetWei,
    FUSED_FEE_BPS: "0",
    FUSED_LP_FEE: "10000",
  });
  assert.equal(ready.ok, true);
  const localOnTestnet = requirePublicCurveParams({
    FUSED_PUBLIC_NETWORK: "robinhood-testnet",
    CHAIN_ID: "46630",
    FUSED_VIRTUAL_QUOTE_WEI: "1",
    FUSED_VIRTUAL_TOKEN: "1",
    FUSED_GRADUATION_TARGET_WEI: LOCAL_CURVE.graduationTargetWei,
    FUSED_FEE_BPS: "0",
    FUSED_LP_FEE: "10000",
  });
  assert.equal(localOnTestnet.ok, false);
  const testnetOnMainnet = requirePublicCurveParams({
    FUSED_PUBLIC_NETWORK: "robinhood",
    CHAIN_ID: "4663",
    FUSED_VIRTUAL_QUOTE_WEI: "1",
    FUSED_VIRTUAL_TOKEN: "1",
    FUSED_GRADUATION_TARGET_WEI: ROBINHOOD_TESTNET_CURVE.graduationTargetWei,
    FUSED_FEE_BPS: "0",
    FUSED_LP_FEE: "10000",
  });
  assert.equal(testnetOnMainnet.ok, false);
});

test("Robinhood testnet live overlay defaults to V2 and keeps V1 legacy", () => {
  const row = readPublicDeploymentManifest(46630);
  assert.equal(row.status, "DEPLOYED");
  assert.equal(row.chainId, 46630);
  assert.match(row.contracts.launchFactory ?? "", /^0x[a-fA-F0-9]{40}$/);
  assert.match(row.contracts.launchLocker ?? "", /^0x[a-fA-F0-9]{40}$/);
  assert.notEqual(row.contracts.launchFactory?.toLowerCase(), "0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0");
  assert.notEqual(row.contracts.launchLocker?.toLowerCase(), "0x75537828f2ce51be7289709686a69cbfdbb714f1");
  const merged = mergeChainDeployment({
    NODE_ENV: "production",
    CHAIN_ID: "46630",
    NEXT_PUBLIC_CHAIN_ID: "46630",
  });
  assert.equal(merged.LAUNCH_FACTORY_V1_ADDRESS, row.contracts.launchFactory);
  assert.equal(merged.LAUNCH_LOCKER_V1_ADDRESS, row.contracts.launchLocker);
  assert.equal(merged.LAUNCH_FACTORY_ADDRESS, ROBINHOOD_TESTNET_LAUNCH_V2.factory);
  assert.equal(merged.LAUNCH_LOCKER_ADDRESS, ROBINHOOD_TESTNET_LAUNCH_V2.locker);
  assert.equal(merged.LAUNCH_FACTORY_V2_ADDRESS, ROBINHOOD_TESTNET_LAUNCH_V2.factory);
  assert.equal(merged.DEFAULT_LAUNCH_VERSION, "v2");
  assert.equal(merged.INDEXER_START_BLOCK, String(row.deployBlock));
  assert.equal(merged.UNISWAP_POOL_MANAGER_ADDRESS?.toLowerCase(), ROBINHOOD_TESTNET_V4.poolManager.toLowerCase());
  assert.equal(merged.NEXT_PUBLIC_RPC_URL, "https://rpc.testnet.chain.robinhood.com");
});

test("production never overlays local-31337.json", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "fused-deploy-"));
  mkdirSync(path.join(dir, "deployments"));
  writeFileSync(
    path.join(dir, "deployments", "local-31337.json"),
    JSON.stringify({
      network: "local",
      chainId: 31337,
      status: "DEPLOYED",
      contracts: {
        launchFactory: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
        launchLocker: "0x75537828f2ce51be7289709686A69CbFDbB714F1",
        poolManager: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
        positionManager: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
        permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
      },
    }),
  );
  const merged = mergeChainDeployment(
    { NODE_ENV: "production", CHAIN_ID: "31337" },
    dir,
  );
  assert.equal(merged.LAUNCH_FACTORY_ADDRESS, undefined);
});

test("Robinhood mainnet 4663 live overlay is V2 with the approved curve", () => {
  const row = readPublicDeploymentManifest(4663);
  assert.equal(row.status, "DEPLOYED");
  assert.equal(row.chainId, 4663);
  assert.equal(row.contracts.launchFactory, ROBINHOOD_MAINNET_LAUNCH_V2.factory);
  assert.equal(row.contracts.launchLocker, ROBINHOOD_MAINNET_LAUNCH_V2.locker);
  assert.equal(row.deployBlock, 64595202);
  assert.equal(row.curve?.virtualQuoteWei, ROBINHOOD_MAINNET_CURVE.virtualQuoteWei);
  assert.equal(row.curve?.graduationTargetWei, ROBINHOOD_MAINNET_CURVE.graduationTargetWei);
  const merged = mergeChainDeployment({
    NODE_ENV: "production",
    CHAIN_ID: "4663",
    NEXT_PUBLIC_CHAIN_ID: "4663",
  });
  assert.equal(merged.LAUNCH_FACTORY_ADDRESS, ROBINHOOD_MAINNET_LAUNCH_V2.factory);
  assert.equal(merged.LAUNCH_LOCKER_ADDRESS, ROBINHOOD_MAINNET_LAUNCH_V2.locker);
  assert.equal(merged.DEFAULT_LAUNCH_VERSION, "v2");
  assert.equal(merged.INDEXER_START_BLOCK, "64595202");
  assert.notEqual(merged.LAUNCH_FACTORY_ADDRESS, ROBINHOOD_TESTNET_LAUNCH_V2.factory);
});

test("example Robinhood JSON does not invent addresses", () => {
  const parsed = parseDeploymentManifest({
    network: "robinhood",
    chainId: 4663,
    status: "NOT_DEPLOYED",
    contracts: { launchFactory: null, launchLocker: null, permit2: null },
  });
  assert.equal(parsed?.status, "NOT_DEPLOYED");
  assert.equal(parsed?.contracts.launchFactory, null);
  assert.equal(parsed?.deployBlock, null);
});

test("production launch stays off until the flag and contracts are set", () => {
  const production = { NODE_ENV: "production" };
  assert.equal(
    isPublicLaunchEnabled(
      {
        chainId: 4663,
        publicChainId: 4663,
        publicRpcUrl: "https://rpc.example",
        contractsOk: true,
      },
      production,
    ),
    false,
  );
  assert.equal(
    isPublicLaunchEnabled(
      {
        chainId: 4663,
        publicChainId: 4663,
        publicRpcUrl: "https://rpc.example",
        contractsOk: true,
      },
      { NODE_ENV: "production", PUBLIC_LAUNCH_ENABLED: "true" },
    ),
    true,
  );
  assert.equal(
    isPublicLaunchEnabled(
      {
        chainId: 31337,
        publicChainId: 31337,
        publicRpcUrl: "http://127.0.0.1:8545",
        contractsOk: true,
      },
      { NODE_ENV: "development" },
    ),
    true,
  );
});
