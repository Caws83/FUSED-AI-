#!/usr/bin/env node
/**
 * Deploy FusedFactoryArc to Arc Testnet (5042002) only.
 * Reads DEPLOYER_PRIVATE_KEY from root `.env` — never from `.env.local`.
 * Never prints the key. Refuses Robinhood and Arc mainnet 5042.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { privateKeyToAccount } from "viem/accounts";
import {
  ARC_MAINNET_CHAIN_ID,
  ARC_MAINNET_V4,
  ARC_TESTNET,
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_CURVE,
  FUSED_TREASURY,
  ROBINHOOD_TESTNET_CHAIN_ID,
  ROBINHOOD_TESTNET_V4,
} from "@fused-ai/config";
import { isAnvilPrivateKey, looksLikePrivateKey, normalizePrivateKey } from "./anvil-keys.mjs";
import { foundryBin, parseEnvFile, repoRoot } from "./repo-env.mjs";

const ROBINHOOD_MAINNET = 4663;
const CANONICAL_USDC = ARC_TESTNET.canonicalUsdc;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readDotEnvDeployerKey() {
  const fromDotEnv = parseEnvFile(path.join(repoRoot(), ".env")).DEPLOYER_PRIVATE_KEY;
  return normalizePrivateKey(fromDotEnv);
}

async function rpc(method, params = []) {
  const res = await fetch(ARC_TESTNET.rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) fail(`RPC HTTP ${res.status} from ${ARC_TESTNET.rpcUrl}`);
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

function parseArcForgeLabels(output) {
  const labels = {};
  for (const line of output.split(/\r?\n/)) {
    const m = line.match(
      /\b(fusedFactoryArc|fusedLocker|deployer|quoteToken|treasury|deployBlock|chainId)\s*:?\s+(0x[a-fA-F0-9]{40}|\d+)\s*$/,
    );
    if (m) labels[m[1]] = m[2];
  }
  return labels;
}

const key = readDotEnvDeployerKey();
if (!key) fail("NEED DEPLOYER_PRIVATE_KEY in root .env (not .env.local). Arc deploy was not broadcast.");
if (!looksLikePrivateKey(key)) fail("DEPLOYER_PRIVATE_KEY in .env is not a 32-byte hex key. Arc deploy was not broadcast.");
if (isAnvilPrivateKey(key)) fail("Refusing the Anvil test key on Arc testnet. Arc deploy was not broadcast.");

let account;
try {
  account = privateKeyToAccount(key);
} catch {
  fail("DEPLOYER_PRIVATE_KEY in .env could not be parsed. Arc deploy was not broadcast.");
}

console.log(`deployer ${account.address}`);

const chainHex = await rpc("eth_chainId");
const chainId = Number(hexToBigInt(chainHex));
if (chainId === ARC_MAINNET_CHAIN_ID) fail("Refusing Arc mainnet 5042. This script is testnet 5042002 only.");
if (chainId === ROBINHOOD_TESTNET_CHAIN_ID || chainId === ROBINHOOD_MAINNET) {
  fail(`Refusing Robinhood chain ${chainId}. Arc deploy was not broadcast.`);
}
if (chainId !== ARC_TESTNET_CHAIN_ID) {
  fail(`RPC chainId is ${chainId}, expected ${ARC_TESTNET_CHAIN_ID}. Arc deploy was not broadcast.`);
}

const usdcCode = await codeSize(CANONICAL_USDC);
console.log(`canonical USDC ${CANONICAL_USDC} code=${usdcCode} bytes`);
if (usdcCode === 0) fail("Canonical ERC20 USDC has no bytecode on Arc testnet.");
const decimalsData = await rpc("eth_call", [{ to: CANONICAL_USDC, data: "0x313ce567" }, "latest"]);
const decimals = Number(hexToBigInt(decimalsData));
console.log(`USDC decimals ${decimals}`);
if (decimals !== 6) fail(`USDC decimals must be 6, got ${decimals}.`);

for (const [name, address] of Object.entries({
  arcMainnetPoolManager: ARC_MAINNET_V4.poolManager,
  arcMainnetPositionManager: ARC_MAINNET_V4.positionManager,
  robinhoodTestnetPositionManager: ROBINHOOD_TESTNET_V4.positionManager,
})) {
  const bytes = await codeSize(address);
  console.log(`dex-probe ${name} ${address} code=${bytes} bytes`);
  if (bytes > 0) fail(`${name} has bytecode on Arc testnet. Refusing to assume DEX availability without a dedicated adapter.`);
}

const balanceHex = await rpc("eth_getBalance", [account.address, "latest"]);
const balance = hexToBigInt(balanceHex);
console.log(`nativeBalance ${balance.toString()} wei`);
if (balance < 20_000_000_000_000_000n) {
  fail("NEED ARC TESTNET USDC. Deployer native balance is below 0.02. Arc deploy was not broadcast.");
}

const forge = foundryBin("forge");
const env = {
  ...process.env,
  DEPLOYER_PRIVATE_KEY: key,
  CHAIN_ID: String(ARC_TESTNET_CHAIN_ID),
  FUSED_PUBLIC_NETWORK: "arc-testnet",
  FUSED_VIRTUAL_QUOTE_WEI: ARC_TESTNET_CURVE.virtualQuoteWei,
  FUSED_VIRTUAL_TOKEN: ARC_TESTNET_CURVE.virtualToken,
  FUSED_GRADUATION_TARGET_WEI: ARC_TESTNET_CURVE.graduationTargetWei,
  FUSED_FEE_BPS: String(ARC_TESTNET_CURVE.feeBps),
  FUSED_LP_FEE: String(ARC_TESTNET_CURVE.lpFee),
};

const result = spawnSync(
  forge,
  [
    "script",
    "script/public/DeployFusedArcTestnet.s.sol:DeployFusedArcTestnet",
    "--rpc-url",
    ARC_TESTNET.rpcUrl,
    "--broadcast",
    "-vv",
  ],
  { cwd: `${repoRoot()}/contracts`, env, encoding: "utf8" },
);
process.stdout.write(result.stdout || "");
process.stderr.write(result.stderr || "");
if (result.status !== 0) process.exit(result.status ?? 1);

const labels = parseArcForgeLabels(`${result.stdout}\n${result.stderr}`);
if (!labels.fusedFactoryArc || !labels.fusedLocker) fail("Missing fusedFactoryArc or fusedLocker in forge output");
for (const [name, address] of [
  ["factory", labels.fusedFactoryArc],
  ["locker", labels.fusedLocker],
]) {
  const bytes = await codeSize(address);
  console.log(`fused ${name} ${address} code=${bytes} bytes`);
  if (bytes === 0) fail(`Deployed ${name} has no bytecode`);
}

const txMatch = `${result.stdout}\n${result.stderr}`.match(/contract address:\s+(0x[a-fA-F0-9]{40})[\s\S]*?transaction hash:\s+(0x[a-fA-F0-9]{64})/i)
  || `${result.stdout}\n${result.stderr}`.match(/Hash:\s+(0x[a-fA-F0-9]{64})/i);
const factoryTx = txMatch?.[2] || txMatch?.[1] || null;

const payload = {
  network: "arc-testnet",
  chainId: ARC_TESTNET_CHAIN_ID,
  generation: "arc",
  status: "DEPLOYED",
  rpcUrl: ARC_TESTNET.rpcUrl,
  explorer: ARC_TESTNET.explorer,
  deployer: account.address,
  contracts: {
    launchFactory: labels.fusedFactoryArc,
    launchLocker: labels.fusedLocker,
    poolManager: null,
    positionManager: null,
    universalRouter: null,
    permit2: null,
    stateView: null,
    quoter: null,
    quoteToken: CANONICAL_USDC,
  },
  curve: {
    virtualQuoteWei: ARC_TESTNET_CURVE.virtualQuoteWei,
    virtualToken: ARC_TESTNET_CURVE.virtualToken,
    graduationTargetWei: ARC_TESTNET_CURVE.graduationTargetWei,
    feeBps: ARC_TESTNET_CURVE.feeBps,
    lpFee: ARC_TESTNET_CURVE.lpFee,
    note: ARC_TESTNET_CURVE.note,
  },
  dex: {
    available: false,
    status: "UNAVAILABLE_ON_TESTNET",
    note: "Official Uniswap V3/V4 exists on Arc mainnet 5042 only. Graduation stays fail-closed on-curve.",
  },
  treasury: FUSED_TREASURY,
  usdc: {
    nativeDecimals: 18,
    erc20: CANONICAL_USDC,
    erc20Decimals: 6,
    scale: "1000000000000",
  },
  deployBlock: labels.deployBlock ? Number(labels.deployBlock) : null,
  transactions: {
    factory: factoryTx,
  },
};
const dir = path.join(repoRoot(), "deployments");
mkdirSync(dir, { recursive: true });
const file = path.join(dir, "arc-testnet-5042002.json");
writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`wrote ${file}`);
console.log("Arc testnet deploy complete. Nothing was broadcast to 5042 or Robinhood.");
