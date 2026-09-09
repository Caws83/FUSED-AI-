import assert from "node:assert/strict";
import test from "node:test";
import { LOCAL_CURVE, PUBLIC_GRADUATION_TARGET_USD, requirePublicCurveParams } from "../src/curve.ts";
import { parseDeploymentManifest, readPublicDeploymentManifest } from "../src/deployment.ts";
import { isPublicLaunchEnabled } from "../src/features.ts";

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

test("Robinhood manifest without a real file is NOT_DEPLOYED", () => {
  const row = readPublicDeploymentManifest(4663);
  assert.equal(row.status, "NOT_DEPLOYED");
  assert.equal(row.contracts.launchFactory, null);
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
