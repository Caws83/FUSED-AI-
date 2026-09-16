#!/usr/bin/env node
/**
 * Robinhood Chain Mainnet (4663) FusedFactoryV2 deploy.
 * Reads DEPLOYER_PRIVATE_KEY from root `.env` only — never `.env.local`.
 * Never prints the key. Refuses 46630, Arc, Anvil keys, and unapproved curve values.
 *
 *   node scripts/deploy-robinhood-mainnet.mjs --preflight-only
 *   node scripts/deploy-robinhood-mainnet.mjs --broadcast
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { encodeAbiParameters, parseAbiParameters } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { FUSED_TREASURY } from "@fused-ai/config";
import { isAnvilPrivateKey, looksLikePrivateKey, normalizePrivateKey } from "./anvil-keys.mjs";
import { foundryBin, parseEnvFile, repoRoot } from "./repo-env.mjs";

const MAINNET_CHAIN_ID = 4663;
const TESTNET_CHAIN_ID = 46630;
const EXPECTED_DEPLOYER = "0xf5fDA9015e0DA7eD406C4c329AB041C2ca6a92EE";
const PUBLIC_RPC = "https://rpc.mainnet.chain.robinhood.com";
const EXPLORER = "https://explorer.chain.robinhood.com";

const V4 = {
  poolManager: "0x8366a39CC670B4001A1121B8F6A443A643e40951",
  positionManager: "0x58daec3116aae6D93017bAAea7749052E8a04fA7",
  permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  stateView: "0xF3334192D15450CdD385c8B70e03f9A6bD9E673b",
  quoter: "0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94",
  universalRouter: "0x8876789976dEcBfCbBbe364623C63652db8C0904",
};
const ARC_POSITION_MANAGER = "0x6049c9A0e26405c0985F9e3685c87D0Ae917F82B";

const CURVE = {
  virtualQuoteWei: "1680000000000000000",
  virtualToken: "1000000000000000000000000000",
  graduationTargetWei: "4200000000000000000",
  feeBps: 100,
  lpFee: 10_000,
};

const FORBIDDEN_TARGETS = new Set([
  "50000000000000000",
  "884558539578982180",
  "10000000000000000",
  "100000000000000000",
  "6000000000000000000",
  "7000000000000000000",
  "8000000000000000000",
]);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readDotEnv() {
  return parseEnvFile(path.join(repoRoot(), ".env"));
}

function readDotEnvDeployerKey() {
  return normalizePrivateKey(readDotEnv().DEPLOYER_PRIVATE_KEY);
}

function rpcUrlFromEnv() {
  const env = readDotEnv();
  for (const name of ["ROBINHOOD_MAINNET_RPC_URL", "ROBINHOOD_RPC_URL"]) {
    const v = String(env[name] || "").trim();
    if (!v) continue;
    if (!/^https:\/\//i.test(v)) fail(`${name} must be https`);
    if (/testnet/i.test(v)) fail(`${name} looks like a testnet RPC`);
    return { url: v, source: name, public: false };
  }
  return { url: PUBLIC_RPC, source: "public", public: true };
}

function redactRpc(url) {
  try {
    const u = new URL(url);
    if (u.search) return `${u.origin}${u.pathname}?<redacted>`;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.some((p) => p.length > 24)) return `${u.origin}/***`;
    return `${u.origin}${u.pathname}`;
  } catch {
    return "<unparseable>";
  }
}

async function rpc(url, method, params = []) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) fail(`RPC HTTP ${res.status}`);
  const body = await res.json();
  if (body.error) fail(`RPC ${method} failed: ${body.error.message || "error"}`);
  return body.result;
}

function hexToBigInt(value) {
  return BigInt(value);
}

async function codeSize(url, address) {
  const code = await rpc(url, "eth_getCode", [address, "latest"]);
  if (!code || code === "0x") return 0;
  return Math.max(0, Math.floor((String(code).length - 2) / 2));
}

function parseMainnetForgeLabels(output) {
  const labels = {};
  for (const line of output.split(/\r?\n/)) {
    const m = line.match(
      /\b(fusedFactoryV2|launchFactory|fusedLocker|launchLocker|deployer|treasury|poolManager|positionManager|permit2|deployBlock|chainId|lpFee|virtualQuote|virtualToken|graduationTarget|deployerBalanceWei)\s+:?\s+(0x[a-fA-F0-9]{40}|\d+)\s*$/,
    );
    if (m) labels[m[1]] = m[2];
  }
  return labels;
}

function factoryCtorData() {
  return encodeAbiParameters(
    parseAbiParameters("address,address,address,(uint256,uint256,uint256,address,uint24)"),
    [
      V4.poolManager,
      V4.positionManager,
      V4.permit2,
      [BigInt(CURVE.virtualQuoteWei), BigInt(CURVE.virtualToken), BigInt(CURVE.graduationTargetWei), FUSED_TREASURY, CURVE.lpFee],
    ],
  );
}

const args = new Set(process.argv.slice(2));
const preflightOnly = args.has("--preflight-only");
const doBroadcast = args.has("--broadcast");
if (!preflightOnly && !doBroadcast) {
  fail("Pass --preflight-only or --broadcast. Refusing to run without an explicit mode.");
}
if (preflightOnly && doBroadcast) fail("Pass only one of --preflight-only or --broadcast.");

if (FORBIDDEN_TARGETS.has(CURVE.virtualQuoteWei) || FORBIDDEN_TARGETS.has(CURVE.graduationTargetWei)) {
  fail("Approved curve constants failed the forbidden-value check.");
}
if (FUSED_TREASURY.toLowerCase() !== "0x6f88e279002051ceb09ead378081df8fc124aacd") {
  fail("Treasury constant mismatch.");
}
if (V4.positionManager.toLowerCase() === ARC_POSITION_MANAGER.toLowerCase()) {
  fail("PositionManager is the Arc address. STOP.");
}

const key = readDotEnvDeployerKey();
if (!key) fail("NEED DEPLOYER_PRIVATE_KEY in root .env (not .env.local). Mainnet deploy was not broadcast.");
if (!looksLikePrivateKey(key)) fail("DEPLOYER_PRIVATE_KEY in .env is not a 32-byte hex key. Mainnet deploy was not broadcast.");
if (isAnvilPrivateKey(key)) fail("Refusing the Anvil test key on Robinhood mainnet. Mainnet deploy was not broadcast.");

let account;
try {
  account = privateKeyToAccount(key);
} catch {
  fail("DEPLOYER_PRIVATE_KEY in .env could not be parsed. Mainnet deploy was not broadcast.");
}
if (account.address.toLowerCase() !== EXPECTED_DEPLOYER.toLowerCase()) {
  fail(`Deployer address mismatch. Expected ${EXPECTED_DEPLOYER}. Mainnet deploy was not broadcast.`);
}

const rpcInfo = rpcUrlFromEnv();
const rpcUrl = rpcInfo.url;
console.log(`rpcSource ${rpcInfo.source}`);
console.log(`rpc ${redactRpc(rpcUrl)}`);

const chainHex = await rpc(rpcUrl, "eth_chainId");
const chainId = Number(hexToBigInt(chainHex));
if (chainId === TESTNET_CHAIN_ID) fail("RPC is Robinhood testnet 46630. STOP.");
if (chainId !== MAINNET_CHAIN_ID) fail(`RPC chainId is ${chainId}, expected ${MAINNET_CHAIN_ID}. STOP.`);

const block1 = Number(hexToBigInt(await rpc(rpcUrl, "eth_blockNumber")));
await new Promise((r) => setTimeout(r, 2500));
const block2 = Number(hexToBigInt(await rpc(rpcUrl, "eth_blockNumber")));
console.log(`chainId ${chainId}`);
console.log(`block ${block1} then ${block2}`);
if (block2 < block1) fail("Block number went backwards. STOP.");

for (const [name, address] of Object.entries(V4)) {
  const bytes = await codeSize(rpcUrl, address);
  console.log(`v4 ${name} ${address} code=${bytes} bytes`);
  if (bytes === 0) fail(`Uniswap v4 ${name} has empty bytecode on 4663. STOP.`);
}
const arcPmBytes = await codeSize(rpcUrl, ARC_POSITION_MANAGER);
console.log(`probe arcPositionManager code=${arcPmBytes} bytes (must not be used)`);

const balance = hexToBigInt(await rpc(rpcUrl, "eth_getBalance", [account.address, "latest"]));
console.log(`deployer ${account.address}`);
console.log(`deployerBalanceWei ${balance.toString()}`);
console.log(`treasury ${FUSED_TREASURY}`);
console.log(`virtualQuote ${CURVE.virtualQuoteWei}`);
console.log(`virtualToken ${CURVE.virtualToken}`);
console.log(`graduationTarget ${CURVE.graduationTargetWei}`);
console.log(`lpFee ${CURVE.lpFee}`);
if (balance < 5_000_000_000_000_000n) fail("Deployer ETH balance is below 0.005. STOP.");

const artifactPath = path.join(repoRoot(), "contracts/out/FusedFactoryV2.sol/FusedFactoryV2.json");
let estimatedGas = 0n;
try {
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
  const data = `${artifact.bytecode.object}${factoryCtorData().slice(2)}`;
  const gasHex = await rpc(rpcUrl, "eth_estimateGas", [{ from: account.address, data }]);
  estimatedGas = hexToBigInt(gasHex);
  console.log(`estimatedGas ${estimatedGas.toString()}`);
} catch (error) {
  fail(`eth_estimateGas failed: ${error instanceof Error ? error.message : "error"}`);
}

const gasPriceHex = await rpc(rpcUrl, "eth_gasPrice");
const gasPrice = hexToBigInt(gasPriceHex);
const cost = estimatedGas * gasPrice;
console.log(`gasPriceWei ${gasPrice.toString()}`);
console.log(`estimatedCostWei ${cost.toString()}`);
if (balance <= cost) fail("Deployer balance is insufficient for estimated gas. STOP.");

console.log("PREFLIGHT PASS");
if (preflightOnly) process.exit(0);

console.log("BROADCASTING one Robinhood 4663 FusedFactoryV2 deployment");
const forge = foundryBin("forge");
const env = {
  ...process.env,
  DEPLOYER_PRIVATE_KEY: key,
  CHAIN_ID: String(MAINNET_CHAIN_ID),
  FUSED_PUBLIC_NETWORK: "robinhood",
};
const result = spawnSync(
  forge,
  [
    "script",
    "script/public/DeployFusedV2Mainnet.s.sol:DeployFusedV2Mainnet",
    "--rpc-url",
    rpcUrl,
    "--broadcast",
    "--slow",
    "-vv",
  ],
  { cwd: `${repoRoot()}/contracts`, env, encoding: "utf8" },
);
process.stdout.write(result.stdout || "");
process.stderr.write(result.stderr || "");
if (result.status !== 0) {
  fail("Broadcast failed. Not retrying.");
}

const labels = parseMainnetForgeLabels(`${result.stdout}\n${result.stderr}`);
const factory = labels.fusedFactoryV2 || labels.launchFactory;
const locker = labels.fusedLocker || labels.launchLocker;
if (!factory || !locker) fail("Missing factory or locker in forge output. Not retrying.");

for (const [name, address] of [
  ["factory", factory],
  ["locker", locker],
]) {
  const bytes = await codeSize(rpcUrl, address);
  console.log(`fused ${name} ${address} code=${bytes} bytes`);
  if (bytes === 0) fail(`Deployed ${name} has no bytecode. STOP.`);
}

const outDir = path.join(repoRoot(), "deployments");
mkdirSync(outDir, { recursive: true });
writeFileSync(
  path.join(outDir, "_robinhood-mainnet-4663-broadcast.json"),
  `${JSON.stringify({ factory, locker, labels, estimatedGas: estimatedGas.toString() }, null, 2)}\n`,
);
console.log("BROADCAST COMPLETE — run on-chain verification next before Railway/Vercel");
