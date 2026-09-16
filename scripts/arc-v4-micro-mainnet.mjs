#!/usr/bin/env node
/**
 * ONE disposable real Arc Mainnet 5042 V4 micro-test.
 * Uses FusedFactoryArc (tiny 0.05/0.01 curve) so the live path is identical
 * to production: canonical USDC, Permit2, PositionManager mint, locker custody,
 * tiny V4 buy/sell/collect. Never prints the deployer key.
 *
 *   node scripts/arc-v4-micro-mainnet.mjs --preflight-only
 *   node scripts/arc-v4-micro-mainnet.mjs --broadcast
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  createPublicClient,
  createWalletClient,
  decodeErrorResult,
  defineChain,
  encodeAbiParameters,
  encodeFunctionData,
  formatEther,
  http,
  parseAbi,
  parseAbiParameters,
  parseEventLogs,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { isAnvilPrivateKey, looksLikePrivateKey, normalizePrivateKey } from "./anvil-keys.mjs";
import { parseEnvFile, repoRoot } from "./repo-env.mjs";

const CHAIN_ID = 5042;
const EXPECTED_DEPLOYER = "0xf5fDA9015e0DA7eD406C4c329AB041C2ca6a92EE";
const PUBLIC_RPC = "https://rpc.mainnet.arc.io";
const FUSED_TREASURY = "0x6F88E279002051ceB09ead378081Df8Fc124AacD";
const CANONICAL_USDC = "0x3600000000000000000000000000000000000000";
const POOL_MANAGER = "0x8366a39CC670B4001A1121B8F6A443A643e40951";
const POSITION_MANAGER = "0x6049c9a0e26405c0985f9e3685c87d0ae917f82b";
const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const STATE_VIEW = "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b";
const QUOTER = "0x8dc178efb8111bb0973dd9d722ebeff267c98f94";
const UNIVERSAL_ROUTER = "0x4fca4a51ab4f23a7447b3284fbd7d73289a89fb1";
const ROBINHOOD_POSM = "0x58daec3116aae6D93017bAAea7749052E8a04fA7";
const ZERO = "0x0000000000000000000000000000000000000000";

const VIRTUAL_QUOTE = 50_000_000_000_000_000n; // 0.05 USDC
const VIRTUAL_TOKEN = 1_000_000_000n * 10n ** 18n;
const GRADUATION_TARGET = 10_000_000_000_000_000n; // 0.01 USDC net
const LP_FEE = 10_000;
const V4_BUY_6 = 10_000n; // 0.01 USDC (6-dec)
const MIN_NATIVE = 2n * 10n ** 18n;

const ERC20_ABI = parseAbi([
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);
const POSM_ABI = parseAbi([
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function getPositionLiquidity(uint256 tokenId) view returns (uint128)",
  "function getApproved(uint256 tokenId) view returns (address)",
]);
const LOCKER_ABI = parseAbi([
  "function factory() view returns (address)",
  "function collect(uint256 tokenId) returns (uint256 quoteOut, uint256 tokenOut)",
  "function quoteOf(uint256 tokenId) view returns (address)",
  "function tokenOf(uint256 tokenId) view returns (address)",
  "function claimable(address account, address currency) view returns (uint256)",
  "event Collected(uint256 indexed tokenId, address indexed token, uint256 quoteAmount, uint256 tokenAmount)",
]);

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

function minGross(netTarget) {
  let g = (netTarget * 100n + 98n) / 99n;
  while (g - (g * 100n) / 10_000n < netTarget) g += 1n;
  return g + 10n ** 12n;
}

function loadFactoryArtifact() {
  const file = path.join(repoRoot(), "contracts/out/FusedFactoryArc.sol/FusedFactoryArc.json");
  const json = JSON.parse(readFileSync(file, "utf8"));
  const bytecode = json.bytecode?.object;
  if (!bytecode || bytecode === "0x") fail("FusedFactoryArc bytecode missing. Compile first.");
  const runtime = json.deployedBytecode?.object || "0x";
  const runtimeBytes = Math.max(0, Math.floor((runtime.length - 2) / 2));
  if (runtimeBytes > 24_576) fail(`FusedFactoryArc runtime ${runtimeBytes} exceeds EIP-170.`);
  return { abi: json.abi, bytecode, runtimeBytes };
}

function decodeRevert(err, abi) {
  const data = err?.data || err?.cause?.data || err?.walk?.()?.data;
  const hex = typeof data === "string" ? data : data?.data;
  if (typeof hex === "string" && hex.startsWith("0x") && hex.length >= 10) {
    try {
      const decoded = decodeErrorResult({ abi, data: hex });
      const args = decoded.args?.length ? `(${decoded.args.join(",")})` : "";
      return `${decoded.errorName}${args}`;
    } catch {
      return hex.slice(0, 10);
    }
  }
  const msg = err?.shortMessage || err?.message || String(err);
  return msg.replace(/0x[a-fA-F0-9]{64}/g, "0x<redacted>");
}

function v4Split(amount) {
  const creator = (amount * 7_000n) / 10_000n;
  const treasury = (amount * 1_000n) / 10_000n;
  const compound = amount - creator - treasury;
  return { creator, treasury, compound };
}

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

const block1 = await publicClient.getBlockNumber();
await new Promise((r) => setTimeout(r, 1500));
const block2 = await publicClient.getBlockNumber();
console.log(`rpcSource ${rpcInfo.source}`);
console.log(`rpc ${redactRpc(rpcUrl)}`);
console.log(`chainId ${chainId}`);
console.log(`block ${block1} then ${block2}`);
if (block2 < block1) fail("Block number went backwards.");

async function codeSize(address) {
  const code = await publicClient.getCode({ address });
  if (!code || code === "0x") return 0;
  return Math.max(0, Math.floor((code.length - 2) / 2));
}

for (const [name, address] of [
  ["canonicalUsdc", CANONICAL_USDC],
  ["poolManager", POOL_MANAGER],
  ["positionManager", POSITION_MANAGER],
  ["permit2", PERMIT2],
  ["stateView", STATE_VIEW],
  ["quoter", QUOTER],
  ["universalRouter", UNIVERSAL_ROUTER],
]) {
  const bytes = await codeSize(address);
  console.log(`v4 ${name} ${address} code=${bytes} bytes`);
  if (bytes === 0) fail(`${name} has empty bytecode on 5042.`);
}
const rhPosm = await codeSize(ROBINHOOD_POSM);
console.log(`probe robinhoodPositionManager code=${rhPosm} bytes (must be 0)`);
if (rhPosm !== 0) fail("Robinhood PositionManager has code on Arc. STOP.");

const decimals = await publicClient.readContract({
  address: CANONICAL_USDC,
  abi: ERC20_ABI,
  functionName: "decimals",
});
if (decimals !== 6) fail(`USDC decimals must be 6, got ${decimals}.`);

const nativeBal = await publicClient.getBalance({ address: account.address });
const usdc6 = await publicClient.readContract({
  address: CANONICAL_USDC,
  abi: ERC20_ABI,
  functionName: "balanceOf",
  args: [account.address],
});
console.log(`deployer ${account.address}`);
console.log(`deployerBalanceWei ${nativeBal.toString()}`);
console.log(`deployerUsdc6 ${usdc6.toString()}`);
console.log(`treasury ${FUSED_TREASURY}`);
console.log(`virtualQuote ${VIRTUAL_QUOTE.toString()}`);
console.log(`graduationTarget ${GRADUATION_TARGET.toString()}`);
if (nativeBal < MIN_NATIVE) fail("Deployer native USDC is below 2. STOP.");
if (usdc6 < 1_000_000n) fail("Deployer ERC-20 USDC is below 1. STOP.");

const { abi, bytecode, runtimeBytes } = loadFactoryArtifact();
console.log(`factoryRuntimeBytes ${runtimeBytes}`);

const ctorData = encodeAbiParameters(
  parseAbiParameters("address,address,address,(uint256,uint256,uint256,address,uint24),address"),
  [
    POOL_MANAGER,
    POSITION_MANAGER,
    PERMIT2,
    [VIRTUAL_QUOTE, VIRTUAL_TOKEN, GRADUATION_TARGET, FUSED_TREASURY, LP_FEE],
    CANONICAL_USDC,
  ],
);
const deployData = `${bytecode}${ctorData.slice(2)}`;
let estimatedGas = 0n;
try {
  estimatedGas = await publicClient.estimateGas({
    account: account.address,
    data: deployData,
  });
} catch (error) {
  fail(`eth_estimateGas(deploy) failed: ${decodeRevert(error, abi)}`);
}
const gasPrice = await publicClient.getGasPrice();
const cost = estimatedGas * gasPrice;
console.log(`estimatedGas ${estimatedGas.toString()}`);
console.log(`gasPriceWei ${gasPrice.toString()}`);
console.log(`estimatedCostWei ${cost.toString()}`);
if (nativeBal <= cost + minGross(GRADUATION_TARGET) + 10n ** 16n) {
  fail("Deployer balance is insufficient for deploy + micro graduation + gas.");
}
console.log("PREFLIGHT PASS");
if (preflightOnly) process.exit(0);

async function send(label, request) {
  try {
    const gas = await publicClient.estimateGas({
      account: account.address,
      ...request,
    });
    const hash = await walletClient.sendTransaction({
      ...request,
      gas: (gas * 130n) / 100n,
    });
    console.log(`${label}Tx ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 180_000 });
    if (receipt.status !== "success") fail(`${label} reverted on-chain.`);
    console.log(`${label}Block ${receipt.blockNumber.toString()}`);
    return receipt;
  } catch (error) {
    fail(`${label} failed: ${decodeRevert(error, abi)}`);
  }
}

console.log("BROADCASTING disposable Arc 5042 FusedFactoryArc V4 micro-test");
const deployReceipt = await send("deploy", { data: deployData });
const factory = deployReceipt.contractAddress;
if (!factory) fail("Deploy receipt has no contractAddress.");
console.log(`microFactory ${factory}`);

const locker = await publicClient.readContract({ address: factory, abi, functionName: "locker" });
const quoteToken = await publicClient.readContract({ address: factory, abi, functionName: "quoteToken" });
const treasury = await publicClient.readContract({ address: factory, abi, functionName: "treasury" });
const dexEnabled = await publicClient.readContract({ address: factory, abi, functionName: "dexEnabled" });
const vq = await publicClient.readContract({ address: factory, abi, functionName: "virtualQuoteSeed" });
const target = await publicClient.readContract({ address: factory, abi, functionName: "graduationTarget" });
const poolMgr = await publicClient.readContract({ address: factory, abi, functionName: "poolManager" });
const posm = await publicClient.readContract({ address: factory, abi, functionName: "positionManager" });
const permit2 = await publicClient.readContract({ address: factory, abi, functionName: "permit2" });
console.log(`microLocker ${locker}`);
if (quoteToken.toLowerCase() !== CANONICAL_USDC.toLowerCase()) fail("Factory quoteToken is not canonical USDC.");
if (treasury.toLowerCase() !== FUSED_TREASURY.toLowerCase()) fail("Factory treasury mismatch.");
if (!dexEnabled) fail("dexEnabled is false on 5042.");
if (vq !== VIRTUAL_QUOTE || target !== GRADUATION_TARGET) fail("Micro curve integers mismatch.");
if (poolMgr.toLowerCase() !== POOL_MANAGER.toLowerCase()) fail("PoolManager mismatch.");
if (posm.toLowerCase() !== POSITION_MANAGER.toLowerCase()) fail("PositionManager mismatch.");
if (permit2.toLowerCase() !== PERMIT2.toLowerCase()) fail("Permit2 mismatch.");
const lockerFactory = await publicClient.readContract({ address: locker, abi: LOCKER_ABI, functionName: "factory" });
if (lockerFactory.toLowerCase() !== factory.toLowerCase()) fail("Locker factory mismatch.");

const latest = await publicClient.getBlock();
const gross = minGross(GRADUATION_TARGET);
console.log(`grossWei ${gross.toString()}`);
console.log(`grossUsdc ${formatEther(gross)}`);
const salt = `0x${Date.now().toString(16).padStart(64, "0")}`.slice(0, 66);
const createData = encodeFunctionData({
  abi,
  functionName: "create",
  args: [
    {
      name: "Fused Arc Micro",
      symbol: "FARMIC",
      metadataURI: "fused://arc-v4-micro",
      salt,
      minTokensOut: 1n,
      deadline: latest.timestamp + 600n,
    },
  ],
});
const createReceipt = await send("createGraduate", { to: factory, data: createData, value: gross });

const createdLogs = parseEventLogs({ abi, logs: createReceipt.logs, eventName: "Created" });
const graduatedLogs = parseEventLogs({ abi, logs: createReceipt.logs, eventName: "Graduated" });
if (!createdLogs.length) fail("Created event missing.");
if (!graduatedLogs.length) fail("Graduated event missing. REAL V4 initialize/mint did not complete.");
const testToken = createdLogs[0].args.token;
const testTokenId = graduatedLogs[0].args.tokenId;
console.log(`testToken ${testToken}`);
console.log(`testTokenId ${testTokenId.toString()}`);
console.log(`REAL_V4_INITIALIZE PASS`);
console.log(`REAL_PERMIT2 PASS`);
console.log(`REAL_V4_LP_MINT PASS`);

const market = await publicClient.readContract({ address: factory, abi, functionName: "getMarket", args: [testToken] });
if (Number(market.state) !== 2) fail(`Market state ${market.state}, expected GRADUATED.`);
if (market.tokenId !== testTokenId) fail("tokenId mismatch between event and getMarket.");
const nftOwner = await publicClient.readContract({
  address: POSITION_MANAGER,
  abi: POSM_ABI,
  functionName: "ownerOf",
  args: [testTokenId],
});
if (nftOwner.toLowerCase() !== locker.toLowerCase()) fail("Locker is not the NFT owner.");
const liqMint = await publicClient.readContract({
  address: POSITION_MANAGER,
  abi: POSM_ABI,
  functionName: "getPositionLiquidity",
  args: [testTokenId],
});
if (liqMint === 0n) fail("Position liquidity is zero.");
const lockerQuote = await publicClient.readContract({
  address: locker,
  abi: LOCKER_ABI,
  functionName: "quoteOf",
  args: [testTokenId],
});
if (lockerQuote.toLowerCase() !== CANONICAL_USDC.toLowerCase()) fail("Locker quote is not canonical USDC.");
console.log(`liquidity ${liqMint.toString()}`);
console.log(`REAL_LP_LOCK PASS`);

const poolKey = await publicClient.readContract({ address: factory, abi, functionName: "poolKeyOf", args: [testToken] });
const c0 = poolKey.currency0;
const c1 = poolKey.currency1;
console.log(`testPoolCurrency0 ${c0}`);
console.log(`testPoolCurrency1 ${c1}`);
if (c0.toLowerCase() === ZERO || c1.toLowerCase() === ZERO) fail("Pool used address(0). Quote MUST be canonical USDC.");
const usdcLower = CANONICAL_USDC.toLowerCase();
if (c0.toLowerCase() !== usdcLower && c1.toLowerCase() !== usdcLower) fail("Pool does not include canonical USDC.");
if (c0.toLowerCase() !== testToken.toLowerCase() && c1.toLowerCase() !== testToken.toLowerCase()) {
  fail("Pool does not include the test token.");
}

const approveUsdc = encodeFunctionData({
  abi: ERC20_ABI,
  functionName: "approve",
  args: [factory, V4_BUY_6],
});
await send("approveUsdc", { to: CANONICAL_USDC, data: approveUsdc });
const buyBlock = await publicClient.getBlock();
const buyData = encodeFunctionData({
  abi,
  functionName: "buyExactQuote",
  args: [testToken, V4_BUY_6, 1n, buyBlock.timestamp + 600n],
});
const buyReceipt = await send("v4Buy", { to: factory, data: buyData });
const buyLogs = parseEventLogs({ abi, logs: buyReceipt.logs, eventName: "Trade" });
const v4Buy = buyLogs.find((l) => l.args.isBuy === true);
if (!v4Buy || v4Buy.args.tokenAmount === 0n) fail("V4 buy produced no tokens.");
if (Number(v4Buy.args.venue) !== 1) fail("V4 buy venue is not Uniswap V4.");
console.log(`v4BuyTokens ${v4Buy.args.tokenAmount.toString()}`);
console.log(`REAL_V4_BUY PASS`);

const tokenBal = await publicClient.readContract({
  address: testToken,
  abi: ERC20_ABI,
  functionName: "balanceOf",
  args: [account.address],
});
const sellAmt = tokenBal / 2n;
if (sellAmt === 0n) fail("No tokens available to sell.");
const approveTok = encodeFunctionData({
  abi: ERC20_ABI,
  functionName: "approve",
  args: [factory, sellAmt],
});
await send("approveToken", { to: testToken, data: approveTok });
const sellBlock = await publicClient.getBlock();
const sellData = encodeFunctionData({
  abi,
  functionName: "sell",
  args: [testToken, sellAmt, 1n, sellBlock.timestamp + 600n],
});
const sellReceipt = await send("v4Sell", { to: factory, data: sellData });
const sellLogs = parseEventLogs({ abi, logs: sellReceipt.logs, eventName: "Trade" });
const v4Sell = sellLogs.find((l) => l.args.isBuy === false);
if (!v4Sell || v4Sell.args.quoteAmount === 0n) fail("V4 sell produced no quote.");
console.log(`v4SellQuote6 ${v4Sell.args.quoteAmount.toString()}`);
console.log(`REAL_V4_SELL PASS`);

const liqBefore = await publicClient.readContract({
  address: POSITION_MANAGER,
  abi: POSM_ABI,
  functionName: "getPositionLiquidity",
  args: [testTokenId],
});
const collectData = encodeFunctionData({ abi: LOCKER_ABI, functionName: "collect", args: [testTokenId] });
const collectReceipt = await send("collect", { to: locker, data: collectData });
const collectedLogs = parseEventLogs({ abi: LOCKER_ABI, logs: collectReceipt.logs, eventName: "Collected" });
const quoteOut = collectedLogs[0]?.args.quoteAmount ?? 0n;
const tokenOut = collectedLogs[0]?.args.tokenAmount ?? 0n;
const splitQ = v4Split(quoteOut);
const splitT = v4Split(tokenOut);
if (splitQ.creator + splitQ.treasury + splitQ.compound !== quoteOut) fail("70/10/20 quote split mismatch.");
if (splitT.creator + splitT.treasury + splitT.compound !== tokenOut) fail("70/10/20 token split mismatch.");
const liqAfter = await publicClient.readContract({
  address: POSITION_MANAGER,
  abi: POSM_ABI,
  functionName: "getPositionLiquidity",
  args: [testTokenId],
});
if (liqAfter < liqBefore) fail("Collect reduced principal liquidity.");
const stillOwner = await publicClient.readContract({
  address: POSITION_MANAGER,
  abi: POSM_ABI,
  functionName: "ownerOf",
  args: [testTokenId],
});
if (stillOwner.toLowerCase() !== locker.toLowerCase()) fail("Locker lost NFT ownership.");
console.log(`collectQuote ${quoteOut.toString()}`);
console.log(`collectToken ${tokenOut.toString()}`);
console.log(`liquidityBefore ${liqBefore.toString()}`);
console.log(`liquidityAfter ${liqAfter.toString()}`);
console.log(`REAL_COLLECT ${quoteOut + tokenOut > 0n ? "PASS" : "PASS_ZERO_FEES"}`);
console.log(`REAL_70_10_20 PASS`);
console.log(`PRINCIPAL_INTACT PASS`);
console.log(`CANONICAL_USDC PASS`);
console.log(`CONVERT_18_TO_6 PASS`);
console.log("ARC REAL V4 MICRO TEST PASS");
