#!/usr/bin/env node
/**
 * Deploy production FusedFactoryArc to Arc Mainnet 5042 only.
 * Exact 40k circulating-MC constructor integers. Never prints the key.
 * Refuses Robinhood, Arc testnet, the disposable micro factory, and tiny curves.
 *
 *   node scripts/deploy-arc-mainnet.mjs --preflight-only
 *   node scripts/deploy-arc-mainnet.mjs --broadcast
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  createPublicClient,
  createWalletClient,
  decodeErrorResult,
  defineChain,
  encodeAbiParameters,
  http,
  parseAbiParameters,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { isAnvilPrivateKey, looksLikePrivateKey, normalizePrivateKey } from "./anvil-keys.mjs";
import { parseEnvFile, repoRoot } from "./repo-env.mjs";

const CHAIN_ID = 5042;
const EXPECTED_DEPLOYER = "0xf5fDA9015e0DA7eD406C4c329AB041C2ca6a92EE";
const PUBLIC_RPC = "https://rpc.mainnet.arc.io";
const EXPLORER = "https://arc-scan.org";
const FUSED_TREASURY = "0x6F88E279002051ceB09ead378081Df8Fc124AacD";
const CANONICAL_USDC = "0x3600000000000000000000000000000000000000";
const POOL_MANAGER = "0x8366a39CC670B4001A1121B8F6A443A643e40951";
const POSITION_MANAGER = "0x6049c9a0e26405c0985f9e3685c87d0ae917f82b";
const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const STATE_VIEW = "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b";
const QUOTER = "0x8dc178efb8111bb0973dd9d722ebeff267c98f94";
const UNIVERSAL_ROUTER = "0x4fca4a51ab4f23a7447b3284fbd7d73289a89fb1";
const ROBINHOOD_POSM = "0x58daec3116aae6D93017bAAea7749052E8a04fA7";
const MICRO_FACTORY = "0x98Cab6d3FaE4783A0D0cB13701d0e9772d6833E5";
const ROBINHOOD_FACTORY = "0x6ab51C6573b1C23e04b91b1DD758Eab011972fF8";

const CURVE = {
  virtualQuote: 4_571_428_571_428_571_428_570n,
  virtualToken: 1_000_000_000n * 10n ** 18n,
  graduationTarget: 11_428_571_428_571_428_571_425n,
  lpFee: 10_000,
};

function fail(message) {
  console.error(`STOPPED SAFELY — ${message}`);
  process.exit(1);
}

function redactRpc(url) {
  try {
    const u = new URL(url);
    if (u.search) return `${u.origin}${u.pathname}?<redacted>`;
    return `${u.origin}${u.pathname}`;
  } catch {
    return "<unparseable>";
  }
}

function readDotEnvDeployerKey() {
  return normalizePrivateKey(parseEnvFile(path.join(repoRoot(), ".env")).DEPLOYER_PRIVATE_KEY);
}

function rpcUrlFromEnv() {
  const env = parseEnvFile(path.join(repoRoot(), ".env"));
  for (const name of ["ARC_MAINNET_RPC_URL", "ARC_RPC_URL"]) {
    const v = String(env[name] || "").trim();
    if (v) return { url: v, source: name };
  }
  return { url: PUBLIC_RPC, source: "default" };
}

function decodeRevert(err, abi) {
  const data = err?.data || err?.cause?.data || err?.walk?.()?.data;
  const hex = typeof data === "string" ? data : data?.data;
  if (typeof hex === "string" && hex.startsWith("0x") && hex.length >= 10) {
    try {
      const decoded = decodeErrorResult({ abi, data: hex });
      return decoded.errorName;
    } catch {
      return hex.slice(0, 10);
    }
  }
  const msg = err?.shortMessage || err?.message || String(err);
  return msg.replace(/0x[a-fA-F0-9]{64}/g, "0x<redacted>");
}

if (CURVE.virtualQuote * 5n !== CURVE.graduationTarget * 2n) fail("ratio != 0.4");
if (CURVE.virtualQuote === 50_000_000_000_000_000n) fail("refusing micro virtualQuote");
if (CURVE.graduationTarget === 10_000_000_000_000_000n) fail("refusing micro target");
if (CURVE.graduationTarget === 35_000n * 10n ** 18n) fail("refusing 35k raise");

const args = new Set(process.argv.slice(2));
const preflightOnly = args.has("--preflight-only");
const doBroadcast = args.has("--broadcast");
if (!preflightOnly && !doBroadcast) fail("Pass --preflight-only or --broadcast.");
if (preflightOnly && doBroadcast) fail("Pass only one of --preflight-only or --broadcast.");

const key = readDotEnvDeployerKey();
if (!key) fail("NEED DEPLOYER_PRIVATE_KEY in root .env (not .env.local).");
if (!looksLikePrivateKey(key)) fail("DEPLOYER_PRIVATE_KEY in .env is not a 32-byte hex key.");
if (isAnvilPrivateKey(key)) fail("Refusing the Anvil test key on Arc mainnet.");

let account;
try {
  account = privateKeyToAccount(key);
} catch {
  fail("DEPLOYER_PRIVATE_KEY in .env could not be parsed.");
}
if (account.address.toLowerCase() !== EXPECTED_DEPLOYER.toLowerCase()) {
  fail(`Deployer address mismatch. Expected ${EXPECTED_DEPLOYER}.`);
}

const rpcInfo = rpcUrlFromEnv();
const rpcUrl = rpcInfo.url;
const arc = defineChain({
  id: CHAIN_ID,
  name: "Arc",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
});
const publicClient = createPublicClient({ chain: arc, transport: http(rpcUrl) });
const walletClient = createWalletClient({ account, chain: arc, transport: http(rpcUrl) });

const chainId = await publicClient.getChainId();
if (chainId === 4663 || chainId === 46630) fail(`RPC is Robinhood ${chainId}. Refusing.`);
if (chainId === 5_042_002) fail("RPC is Arc testnet 5042002. Refusing.");
if (chainId !== CHAIN_ID) fail(`RPC chainId is ${chainId}, expected ${CHAIN_ID}.`);

const artifact = JSON.parse(
  readFileSync(path.join(repoRoot(), "contracts/out/FusedFactoryArc.sol/FusedFactoryArc.json"), "utf8"),
);
const abi = artifact.abi;
const bytecode = artifact.bytecode.object;
const runtimeBytes = Math.max(0, Math.floor((artifact.deployedBytecode.object.length - 2) / 2));
if (runtimeBytes > 24_576) fail(`FusedFactoryArc runtime ${runtimeBytes} exceeds EIP-170.`);

const ctorData = encodeAbiParameters(
  parseAbiParameters("address,address,address,(uint256,uint256,uint256,address,uint24),address"),
  [
    POOL_MANAGER,
    POSITION_MANAGER,
    PERMIT2,
    [CURVE.virtualQuote, CURVE.virtualToken, CURVE.graduationTarget, FUSED_TREASURY, CURVE.lpFee],
    CANONICAL_USDC,
  ],
);
const deployData = `${bytecode}${ctorData.slice(2)}`;

console.log(`rpcSource ${rpcInfo.source}`);
console.log(`rpc ${redactRpc(rpcUrl)}`);
console.log(`chainId ${chainId}`);
console.log(`deployer ${account.address}`);
console.log(`treasury ${FUSED_TREASURY}`);
console.log(`virtualQuote ${CURVE.virtualQuote.toString()}`);
console.log(`virtualToken ${CURVE.virtualToken.toString()}`);
console.log(`graduationTarget ${CURVE.graduationTarget.toString()}`);
console.log(`lpFee ${CURVE.lpFee}`);
console.log(`factoryRuntimeBytes ${runtimeBytes}`);

const usdcCode = await publicClient.getCode({ address: CANONICAL_USDC });
if (!usdcCode || usdcCode === "0x") fail("Canonical USDC missing.");
const decimals = await publicClient.readContract({
  address: CANONICAL_USDC,
  abi: [{ type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] }],
  functionName: "decimals",
});
if (decimals !== 6) fail(`USDC decimals must be 6, got ${decimals}.`);

for (const [name, address] of [
  ["poolManager", POOL_MANAGER],
  ["positionManager", POSITION_MANAGER],
  ["permit2", PERMIT2],
  ["stateView", STATE_VIEW],
  ["quoter", QUOTER],
  ["universalRouter", UNIVERSAL_ROUTER],
]) {
  const code = await publicClient.getCode({ address });
  const bytes = code && code !== "0x" ? (code.length - 2) / 2 : 0;
  console.log(`v4 ${name} ${address} code=${bytes} bytes`);
  if (!bytes) fail(`${name} empty on 5042.`);
}
const rhPosm = await publicClient.getCode({ address: ROBINHOOD_POSM });
if (rhPosm && rhPosm !== "0x") fail("Robinhood PositionManager has code on Arc.");

const nativeBal = await publicClient.getBalance({ address: account.address });
console.log(`deployerBalanceWei ${nativeBal.toString()}`);
if (nativeBal < 2n * 10n ** 18n) fail("Deployer native USDC is below 2.");

let estimatedGas = 0n;
try {
  estimatedGas = await publicClient.estimateGas({ account: account.address, data: deployData });
} catch (error) {
  fail(`eth_estimateGas(deploy) failed: ${decodeRevert(error, abi)}`);
}
const gasPrice = await publicClient.getGasPrice();
console.log(`estimatedGas ${estimatedGas.toString()}`);
console.log(`gasPriceWei ${gasPrice.toString()}`);
if (nativeBal <= estimatedGas * gasPrice) fail("Insufficient balance for production deploy.");
console.log("PREFLIGHT PASS");
if (preflightOnly) process.exit(0);

console.log("BROADCASTING one Arc 5042 FusedFactoryArc production deployment");
let hash;
try {
  hash = await walletClient.sendTransaction({
    data: deployData,
    gas: (estimatedGas * 130n) / 100n,
  });
} catch (error) {
  fail(`broadcast failed: ${decodeRevert(error, abi)}`);
}
console.log(`deployTx ${hash}`);
const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 180_000 });
if (receipt.status !== "success") fail("Production deploy reverted.");
const factory = receipt.contractAddress;
if (!factory) fail("Deploy receipt has no contractAddress.");
if (factory.toLowerCase() === MICRO_FACTORY.toLowerCase()) fail("Deployed at disposable micro factory address.");
if (factory.toLowerCase() === ROBINHOOD_FACTORY.toLowerCase()) fail("Deployed at Robinhood factory address.");
console.log(`fusedFactoryArc ${factory}`);
console.log(`deployBlock ${receipt.blockNumber.toString()}`);

async function read(fn, args = []) {
  return publicClient.readContract({ address: factory, abi, functionName: fn, args });
}

const locker = await read("locker");
const quoteToken = await read("quoteToken");
const treasury = await read("treasury");
const vq = await read("virtualQuoteSeed");
const vt = await read("virtualTokenSeed");
const target = await read("graduationTarget");
const lpFee = await read("graduatedLpFee");
const feeBps = await read("feeBps");
const creatorBps = await read("creatorFeeBps");
const treasuryBps = await read("treasuryFeeBps");
const poolMgr = await read("poolManager");
const posm = await read("positionManager");
const permit2 = await read("permit2");
const dexEnabled = await read("dexEnabled");
console.log(`fusedLocker ${locker}`);

if (!dexEnabled) fail("dexEnabled is false.");
if (quoteToken.toLowerCase() !== CANONICAL_USDC.toLowerCase()) fail("quoteToken mismatch.");
if (treasury.toLowerCase() !== FUSED_TREASURY.toLowerCase()) fail("treasury mismatch.");
if (vq !== CURVE.virtualQuote) fail("virtualQuote mismatch.");
if (vt !== CURVE.virtualToken) fail("virtualToken mismatch.");
if (target !== CURVE.graduationTarget) fail("graduationTarget mismatch.");
if (Number(lpFee) !== CURVE.lpFee) fail("lpFee mismatch.");
if (Number(feeBps) !== 100 || Number(creatorBps) !== 30 || Number(treasuryBps) !== 70) fail("curve fee split mismatch.");
if (poolMgr.toLowerCase() !== POOL_MANAGER.toLowerCase()) fail("PoolManager mismatch.");
if (posm.toLowerCase() !== POSITION_MANAGER.toLowerCase()) fail("PositionManager mismatch.");
if (permit2.toLowerCase() !== PERMIT2.toLowerCase()) fail("Permit2 mismatch.");

const lockerFactory = await publicClient.readContract({
  address: locker,
  abi: [{ type: "function", name: "factory", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] }],
  functionName: "factory",
});
if (lockerFactory.toLowerCase() !== factory.toLowerCase()) fail("locker.factory mismatch.");

for (const [name, address] of [
  ["factory", factory],
  ["locker", locker],
]) {
  const code = await publicClient.getCode({ address });
  if (!code || code === "0x") fail(`Deployed ${name} has no bytecode.`);
}

async function hasOwner(address) {
  try {
    const result = await publicClient.call({ to: address, data: "0x8da5cb5b" });
    return Boolean(result.data && result.data !== "0x");
  } catch {
    return false;
  }
}
if (await hasOwner(factory)) fail("factory unexpectedly implements owner().");
if (await hasOwner(locker)) fail("locker unexpectedly implements owner().");

const payload = {
  network: "arc",
  chainId: CHAIN_ID,
  generation: "arc",
  status: "DEPLOYED",
  rpcUrl: PUBLIC_RPC,
  explorer: EXPLORER,
  deployer: account.address,
  contracts: {
    launchFactory: factory,
    launchLocker: locker,
    poolManager: POOL_MANAGER,
    positionManager: POSITION_MANAGER,
    universalRouter: UNIVERSAL_ROUTER,
    permit2: PERMIT2,
    stateView: STATE_VIEW,
    quoter: QUOTER,
    quoteToken: CANONICAL_USDC,
  },
  curve: {
    virtualQuoteWei: CURVE.virtualQuote.toString(),
    virtualToken: CURVE.virtualToken.toString(),
    graduationTargetWei: CURVE.graduationTarget.toString(),
    feeBps: 100,
    lpFee: CURVE.lpFee,
    ratio: "0.4",
    circulatingMcApprox: "39999999999999285714286",
    fdvApprox: "55999999999999000000000",
    note: "Arc mainnet 5042. ~$40k circulating MC at graduation. 1% curve 30/70. V4 70/10/20. Canonical USDC.",
  },
  usdc: {
    nativeDecimals: 18,
    erc20: CANONICAL_USDC,
    erc20Decimals: 6,
    scale: "1000000000000",
  },
  treasury: FUSED_TREASURY,
  fees: {
    curveBps: 100,
    creatorCurveBps: 30,
    treasuryCurveBps: 70,
    v4CreatorBps: 7000,
    v4TreasuryBps: 1000,
    v4CompoundBps: 2000,
  },
  deployBlock: Number(receipt.blockNumber),
  transactions: {
    factory: hash,
  },
  microTest: {
    disposableFactory: MICRO_FACTORY,
    note: "Disposable V4 micro-test factory. Not used for public launches.",
  },
};
const dir = path.join(repoRoot(), "deployments");
mkdirSync(dir, { recursive: true });
const file = path.join(dir, "arc-mainnet-5042.json");
writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`wrote ${file}`);
console.log("Arc mainnet production factory deployed. No public token was launched.");
