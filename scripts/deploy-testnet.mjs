#!/usr/bin/env node
/**
 * Deploy Fused factory/locker to Robinhood Chain Testnet (46630) only.
 * Reads DEPLOYER_PRIVATE_KEY from root `.env` — never from `.env.local` (Anvil).
 * Refuses Anvil keys, empty keys, mainnet 4663, and unfunded accounts.
 * Does not broadcast unless a real funded testnet key is present.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { privateKeyToAccount } from "viem/accounts";
import {
  ROBINHOOD_TESTNET,
  ROBINHOOD_TESTNET_CHAIN_ID,
  ROBINHOOD_TESTNET_CURVE,
  ROBINHOOD_TESTNET_V4,
} from "@fused-ai/config";
import { isAnvilPrivateKey, looksLikePrivateKey, normalizePrivateKey } from "./anvil-keys.mjs";
import { foundryBin, parseEnvFile, repoRoot } from "./repo-env.mjs";
import { parseForgeLabels } from "./write-local-env.mjs";

const MAINNET_CHAIN_ID = 4663;
const ANVIL_CREATE = new Set([
  "0x5fbdb2315678afecb367f032d93f642f64180aa3",
  "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512",
  "0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0",
  "0x75537828f2ce51be7289709686a69cbfdbb714f1",
]);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readDotEnvDeployerKey() {
  const root = repoRoot();
  const fromDotEnv = parseEnvFile(path.join(root, ".env")).DEPLOYER_PRIVATE_KEY;
  return normalizePrivateKey(fromDotEnv);
}

async function rpc(method, params = []) {
  const res = await fetch(ROBINHOOD_TESTNET.rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) fail(`RPC HTTP ${res.status} from ${ROBINHOOD_TESTNET.rpcUrl}`);
  const body = await res.json();
  if (body.error) fail(`RPC ${method} failed: ${body.error.message || JSON.stringify(body.error)}`);
  return body.result;
}

function hexToBigInt(value) {
  return BigInt(value);
}

async function codeSize(address) {
  const code = await rpc("eth_getCode", [address, "latest"]);
  if (!code || code === "0x") return 0;
  return Math.max(0, Math.floor((String(code).length - 2) / 2));
}

const key = readDotEnvDeployerKey();
if (!key) {
  fail("NEED DEPLOYER_PRIVATE_KEY in root .env (not .env.local). Public deploy was not broadcast.");
}
if (!looksLikePrivateKey(key)) {
  fail("DEPLOYER_PRIVATE_KEY in .env is not a 32-byte hex key. Public deploy was not broadcast.");
}
if (isAnvilPrivateKey(key)) {
  fail("Refusing the Anvil test key on Robinhood testnet. Put a real key in root .env. Public deploy was not broadcast.");
}

let account;
try {
  account = privateKeyToAccount(key);
} catch {
  fail("DEPLOYER_PRIVATE_KEY in .env could not be parsed. Public deploy was not broadcast.");
}

console.log(`deployer ${account.address}`);

const chainHex = await rpc("eth_chainId");
const chainId = Number(hexToBigInt(chainHex));
if (chainId === MAINNET_CHAIN_ID) {
  fail("Refusing Robinhood mainnet (4663). This script is testnet 46630 only.");
}
if (chainId !== ROBINHOOD_TESTNET_CHAIN_ID) {
  fail(`RPC chainId is ${chainId}, expected ${ROBINHOOD_TESTNET_CHAIN_ID}. Public deploy was not broadcast.`);
}

for (const [name, address] of Object.entries({
  poolManager: ROBINHOOD_TESTNET_V4.poolManager,
  positionManager: ROBINHOOD_TESTNET_V4.positionManager,
  permit2: ROBINHOOD_TESTNET_V4.permit2,
})) {
  if (ANVIL_CREATE.has(address.toLowerCase())) fail(`Refusing Anvil CREATE address for ${name}`);
  const bytes = await codeSize(address);
  console.log(`v4 ${name} ${address} code=${bytes} bytes`);
  if (bytes === 0) fail(`Uniswap v4 ${name} has no bytecode on testnet. Refusing to deploy a fake stack.`);
}

const balanceHex = await rpc("eth_getBalance", [account.address, "latest"]);
const balance = hexToBigInt(balanceHex);
console.log(`balance ${balance.toString()} wei`);
if (balance === 0n) {
  fail("NEED ROBINHOOD TESTNET ETH. Deployer balance is 0. Public deploy was not broadcast.");
}

const forge = foundryBin("forge");
const env = {
  ...process.env,
  DEPLOYER_PRIVATE_KEY: key,
  CHAIN_ID: String(ROBINHOOD_TESTNET_CHAIN_ID),
  FUSED_PUBLIC_NETWORK: "robinhood-testnet",
  FUSED_VIRTUAL_QUOTE_WEI: ROBINHOOD_TESTNET_CURVE.virtualQuoteWei,
  FUSED_VIRTUAL_TOKEN: ROBINHOOD_TESTNET_CURVE.virtualToken,
  FUSED_GRADUATION_TARGET_WEI: ROBINHOOD_TESTNET_CURVE.graduationTargetWei,
  FUSED_FEE_BPS: String(ROBINHOOD_TESTNET_CURVE.feeBps),
  FUSED_LP_FEE: String(ROBINHOOD_TESTNET_CURVE.lpFee),
  UNISWAP_POOL_MANAGER_ADDRESS: ROBINHOOD_TESTNET_V4.poolManager,
  UNISWAP_POSITION_MANAGER_ADDRESS: ROBINHOOD_TESTNET_V4.positionManager,
  UNISWAP_PERMIT2_ADDRESS: ROBINHOOD_TESTNET_V4.permit2,
};

const result = spawnSync(
  forge,
  [
    "script",
    "script/public/DeployFusedTestnet.s.sol:DeployFusedTestnet",
    "--rpc-url",
    ROBINHOOD_TESTNET.rpcUrl,
    "--broadcast",
    "-vv",
  ],
  { cwd: `${repoRoot()}/contracts`, env, encoding: "utf8" },
);
process.stdout.write(result.stdout || "");
process.stderr.write(result.stderr || "");
if (result.status !== 0) process.exit(result.status ?? 1);

const labels = parseForgeLabels(`${result.stdout}\n${result.stderr}`);
for (const name of ["launchFactory", "launchLocker"]) {
  if (!labels[name]) fail(`Missing ${name} in forge output`);
  if (ANVIL_CREATE.has(labels[name].toLowerCase())) fail(`Refusing Anvil CREATE address for ${name}`);
  const bytes = await codeSize(labels[name]);
  console.log(`fused ${name} ${labels[name]} code=${bytes} bytes`);
  if (bytes === 0) fail(`Deployed ${name} has no bytecode`);
}

const payload = {
  network: "robinhood-testnet",
  chainId: ROBINHOOD_TESTNET_CHAIN_ID,
  status: "DEPLOYED",
  rpcUrl: ROBINHOOD_TESTNET.rpcUrl,
  explorer: ROBINHOOD_TESTNET.explorer,
  deployer: account.address,
  contracts: {
    launchFactory: labels.launchFactory,
    launchLocker: labels.launchLocker,
    poolManager: ROBINHOOD_TESTNET_V4.poolManager,
    positionManager: ROBINHOOD_TESTNET_V4.positionManager,
    universalRouter: ROBINHOOD_TESTNET_V4.universalRouter,
    permit2: ROBINHOOD_TESTNET_V4.permit2,
    stateView: ROBINHOOD_TESTNET_V4.stateView,
    quoter: ROBINHOOD_TESTNET_V4.quoter,
  },
  curve: {
    virtualQuoteWei: ROBINHOOD_TESTNET_CURVE.virtualQuoteWei,
    virtualToken: ROBINHOOD_TESTNET_CURVE.virtualToken,
    graduationTargetWei: ROBINHOOD_TESTNET_CURVE.graduationTargetWei,
    feeBps: ROBINHOOD_TESTNET_CURVE.feeBps,
    lpFee: ROBINHOOD_TESTNET_CURVE.lpFee,
    note: ROBINHOOD_TESTNET_CURVE.note,
  },
  deployBlock: labels.deployBlock ? Number(labels.deployBlock) : null,
};
const dir = path.join(repoRoot(), "deployments");
mkdirSync(dir, { recursive: true });
const file = path.join(dir, "robinhood-testnet-46630.json");
writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`wrote ${file}`);
console.log("Optional Blockscout verify is separate. A verify failure is not a reason to redeploy.");
