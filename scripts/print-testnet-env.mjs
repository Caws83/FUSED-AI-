#!/usr/bin/env node
/**
 * Print public Vercel env for Robinhood testnet. No secrets.
 * Default factory/locker are V2. Legacy V1 addresses are printed separately.
 */
import {
  readPublicDeploymentManifest,
  readPublicV2DeploymentManifest,
  ROBINHOOD_TESTNET,
  ROBINHOOD_TESTNET_CHAIN_ID,
  ROBINHOOD_TESTNET_V4,
} from "@fused-ai/config";

const SECRET_KEYS = new Set([
  "DEPLOYER_PRIVATE_KEY",
  "X_BEARER_TOKEN",
  "X_APP_ONLY_TOKEN",
  "X_API_KEY",
  "X_API_SECRET",
  "AI_API_KEY",
  "AI_IMAGE_API_KEY",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_ACCESS_KEY_ID",
  "DATABASE_URL",
]);

const v1 = readPublicDeploymentManifest(ROBINHOOD_TESTNET_CHAIN_ID);
const v2 = readPublicV2DeploymentManifest(ROBINHOOD_TESTNET_CHAIN_ID);
const c = v2?.status === "DEPLOYED" ? v2.contracts : v1.contracts;
const defaultFactory = v2?.status === "DEPLOYED" ? v2.contracts.launchFactory : v1.status === "DEPLOYED" ? v1.contracts.launchFactory : null;
const defaultLocker = v2?.status === "DEPLOYED" ? v2.contracts.launchLocker : v1.status === "DEPLOYED" ? v1.contracts.launchLocker : null;
const rpc = v1.rpcUrl || ROBINHOOD_TESTNET.rpcUrl;
const v4 = {
  poolManager: c.poolManager || ROBINHOOD_TESTNET_V4.poolManager,
  positionManager: c.positionManager || ROBINHOOD_TESTNET_V4.positionManager,
  permit2: c.permit2 || ROBINHOOD_TESTNET_V4.permit2,
  universalRouter: c.universalRouter || ROBINHOOD_TESTNET_V4.universalRouter,
  stateView: c.stateView || ROBINHOOD_TESTNET_V4.stateView,
  quoter: c.quoter || ROBINHOOD_TESTNET_V4.quoter,
};

const rows = [
  ["NEXT_PUBLIC_APP_URL", "<your Vercel URL, e.g. https://your-app.vercel.app>"],
  ["NEXT_PUBLIC_CHAIN_ID", String(ROBINHOOD_TESTNET_CHAIN_ID)],
  ["NEXT_PUBLIC_RPC_URL", rpc],
  ["CHAIN_ID", String(ROBINHOOD_TESTNET_CHAIN_ID)],
  ["RPC_URL", rpc],
  ["PUBLIC_CHAIN_CONFIGURED", "true"],
  ["PUBLIC_LAUNCH_ENABLED", defaultFactory ? "true" : "false"],
  ["UNISWAP_POOL_MANAGER_ADDRESS", v4.poolManager],
  ["UNISWAP_POSITION_MANAGER_ADDRESS", v4.positionManager],
  ["UNISWAP_PERMIT2_ADDRESS", v4.permit2],
  ["UNISWAP_UNIVERSAL_ROUTER_ADDRESS", v4.universalRouter],
  ["UNISWAP_STATE_VIEW", v4.stateView],
  ["UNISWAP_QUOTER", v4.quoter],
];

if (defaultFactory) {
  rows.push(["DEFAULT_LAUNCH_VERSION", v2?.status === "DEPLOYED" ? "v2" : "v1"]);
  rows.push(["LAUNCH_FACTORY_ADDRESS", defaultFactory]);
}
if (defaultLocker) rows.push(["LAUNCH_LOCKER_ADDRESS", defaultLocker]);
if (v1.status === "DEPLOYED" && v1.contracts.launchFactory) {
  rows.push(["LAUNCH_FACTORY_V1_ADDRESS", v1.contracts.launchFactory]);
  if (v1.contracts.launchLocker) rows.push(["LAUNCH_LOCKER_V1_ADDRESS", v1.contracts.launchLocker]);
  if (v1.deployBlock != null) rows.push(["LAUNCH_V1_DEPLOY_BLOCK", String(v1.deployBlock)]);
}
if (v2?.status === "DEPLOYED" && v2.contracts.launchFactory) {
  rows.push(["LAUNCH_FACTORY_V2_ADDRESS", v2.contracts.launchFactory]);
  if (v2.contracts.launchLocker) rows.push(["LAUNCH_LOCKER_V2_ADDRESS", v2.contracts.launchLocker]);
  if (v2.deployBlock != null) rows.push(["LAUNCH_V2_DEPLOY_BLOCK", String(v2.deployBlock)]);
}
if (v1.deployBlock != null && v1.deployBlock > 0) {
  rows.push(["INDEXER_START_BLOCK", String(v1.deployBlock)]);
}

console.log(`# FUSED AI — Robinhood Chain Testnet (${ROBINHOOD_TESTNET_CHAIN_ID})`);
console.log(`# Network: ${ROBINHOOD_TESTNET.name}`);
console.log(`# Explorer: ${ROBINHOOD_TESTNET.explorer}`);
console.log(`# Default launches: ${v2?.status === "DEPLOYED" ? "FusedFactoryV2" : v1.status}`);
console.log(`# Legacy V1 factory remains indexed. Do not delete V1 support.`);
if (!defaultFactory) {
  console.log("# LAUNCH_FACTORY_ADDRESS and LAUNCH_LOCKER_ADDRESS are unset. Do not invent them.");
}
console.log("# Paste public values into Vercel. Do not paste deployer keys, X, AI, DB, or AWS secrets.");
console.log("");
for (const [key, value] of rows) {
  if (SECRET_KEYS.has(key)) {
    console.error(`Refusing to print secret ${key}`);
    process.exit(1);
  }
  console.log(`${key}=${value}`);
}
