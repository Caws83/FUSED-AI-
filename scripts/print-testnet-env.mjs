#!/usr/bin/env node
/**
 * Print public Vercel env for Robinhood testnet. No secrets.
 * Factory/locker stay unset until deployments/robinhood-testnet-46630.json is DEPLOYED.
 */
import { readPublicDeploymentManifest } from "@fused-ai/config";
import {
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

const manifest = readPublicDeploymentManifest(ROBINHOOD_TESTNET_CHAIN_ID);
const c = manifest.contracts;
const factory = manifest.status === "DEPLOYED" ? c.launchFactory : null;
const locker = manifest.status === "DEPLOYED" ? c.launchLocker : null;
const rpc = manifest.rpcUrl || ROBINHOOD_TESTNET.rpcUrl;
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
  ["PUBLIC_LAUNCH_ENABLED", factory ? "true" : "false"],
  ["UNISWAP_POOL_MANAGER_ADDRESS", v4.poolManager],
  ["UNISWAP_POSITION_MANAGER_ADDRESS", v4.positionManager],
  ["UNISWAP_PERMIT2_ADDRESS", v4.permit2],
  ["UNISWAP_UNIVERSAL_ROUTER_ADDRESS", v4.universalRouter],
  ["UNISWAP_STATE_VIEW", v4.stateView],
  ["UNISWAP_QUOTER", v4.quoter],
];

if (factory) rows.push(["LAUNCH_FACTORY_ADDRESS", factory]);
if (locker) rows.push(["LAUNCH_LOCKER_ADDRESS", locker]);
if (manifest.deployBlock != null && manifest.deployBlock > 0) {
  rows.push(["INDEXER_START_BLOCK", String(manifest.deployBlock)]);
}

console.log(`# FUSED AI — Robinhood Chain Testnet (${ROBINHOOD_TESTNET_CHAIN_ID})`);
console.log(`# Network: ${ROBINHOOD_TESTNET.name}`);
console.log(`# Explorer: ${ROBINHOOD_TESTNET.explorer}`);
console.log(`# Fused contracts: ${manifest.status}`);
if (manifest.status !== "DEPLOYED") {
  console.log("# LAUNCH_FACTORY_ADDRESS and LAUNCH_LOCKER_ADDRESS are unset. Do not invent them.");
  console.log("# After a real deploy, committed deployments/robinhood-testnet-46630.json fills them.");
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
