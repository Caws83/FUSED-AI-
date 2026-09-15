#!/usr/bin/env node
/**
 * Arc testnet 5042002 smoke: create / buy / sell / claim / graduation-ready.
 * Never prints DEPLOYER_PRIVATE_KEY. Does not touch Robinhood.
 */
import path from "node:path";
import { createPublicClient, createWalletClient, http, parseEventLogs, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defineChain } from "viem";
import {
  ARC_TESTNET,
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_LAUNCH,
  FUSED_TREASURY,
  ROBINHOOD_TESTNET_LAUNCH_V2,
  nativeCurrencyFor,
} from "@fused-ai/config";
import { ERC20_ABI, FUSED_FACTORY_ABI, FUSED_FACTORY_CLAIM_ABI } from "@fused-ai/blockchain";
import { isAnvilPrivateKey, looksLikePrivateKey, normalizePrivateKey } from "./anvil-keys.mjs";
import { parseEnvFile, repoRoot } from "./repo-env.mjs";

const EXTRA_ABI = [
  { type: "function", name: "reservedFees", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "dexEnabled", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "isGraduationReady", stateMutability: "view", inputs: [{ name: "token", type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "quoteToken", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "graduate", stateMutability: "nonpayable", inputs: [{ name: "token", type: "address" }], outputs: [] },
  {
    type: "error",
    name: "DexUnavailable",
    inputs: [],
  },
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

const key = normalizePrivateKey(parseEnvFile(path.join(repoRoot(), ".env")).DEPLOYER_PRIVATE_KEY);
if (!key || !looksLikePrivateKey(key) || isAnvilPrivateKey(key)) {
  fail("NEED a real DEPLOYER_PRIVATE_KEY in root .env for Arc smoke.");
}

if (!ARC_TESTNET_LAUNCH.factory || !ARC_TESTNET_LAUNCH.locker) fail("Arc factory/locker missing");
if (ARC_TESTNET_LAUNCH.factory.toLowerCase() === ROBINHOOD_TESTNET_LAUNCH_V2.factory.toLowerCase()) {
  fail("Arc factory must not equal Robinhood V2 factory");
}

const account = privateKeyToAccount(key);
const chain = defineChain({
  id: ARC_TESTNET_CHAIN_ID,
  name: ARC_TESTNET.name,
  nativeCurrency: nativeCurrencyFor(ARC_TESTNET_CHAIN_ID),
  rpcUrls: { default: { http: [ARC_TESTNET.rpcUrl] } },
});
const publicClient = createPublicClient({ chain, transport: http(ARC_TESTNET.rpcUrl) });
const walletClient = createWalletClient({ account, chain, transport: http(ARC_TESTNET.rpcUrl) });
const factory = ARC_TESTNET_LAUNCH.factory;
const abi = [...FUSED_FACTORY_ABI, ...FUSED_FACTORY_CLAIM_ABI, ...EXTRA_ABI];

const chainId = await publicClient.getChainId();
if (chainId !== ARC_TESTNET_CHAIN_ID) fail(`wallet/rpc chain ${chainId} is not 5042002`);

const dex = await publicClient.readContract({ address: factory, abi, functionName: "dexEnabled" });
if (dex) fail("dexEnabled must be false on Arc testnet");

const salt = `0x${Buffer.from(`ARCSMOKE${Date.now()}`).toString("hex").slice(0, 64).padEnd(64, "0")}`;
const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

console.log("smoke create");
const createHash = await walletClient.writeContract({
  address: factory,
  abi,
  functionName: "create",
  args: [
    {
      name: "ArcSmoke",
      symbol: "ASMOKE",
      metadataURI: "arc://smoke",
      salt,
      minTokensOut: 0n,
      deadline,
    },
  ],
});
const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createHash });
if (createReceipt.status !== "success") fail("create failed");
const created = parseEventLogs({ abi: FUSED_FACTORY_ABI, logs: createReceipt.logs, eventName: "Created" })[0];
const token = created?.args.token;
if (!token) fail("no Created token");
console.log(`token ${token}`);
console.log(`createTx ${createHash}`);

console.log("smoke buy 0.005");
const buyHash = await walletClient.writeContract({
  address: factory,
  abi,
  functionName: "buy",
  args: [token, 1n, BigInt(Math.floor(Date.now() / 1000) + 600)],
  value: parseEther("0.005"),
});
await publicClient.waitForTransactionReceipt({ hash: buyHash });
console.log(`buyTx ${buyHash}`);

const bal = await publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: "balanceOf", args: [account.address] });
console.log("smoke sell half");
const approveHash = await walletClient.writeContract({
  address: token,
  abi: ERC20_ABI,
  functionName: "approve",
  args: [factory, bal / 2n],
});
await publicClient.waitForTransactionReceipt({ hash: approveHash });
const sellHash = await walletClient.writeContract({
  address: factory,
  abi,
  functionName: "sell",
  args: [token, bal / 2n, 1n, BigInt(Math.floor(Date.now() / 1000) + 600)],
});
await publicClient.waitForTransactionReceipt({ hash: sellHash });
console.log(`sellTx ${sellHash}`);

const market = await publicClient.readContract({ address: factory, abi, functionName: "getMarket", args: [token] });
const creatorClaimable = await publicClient.readContract({
  address: factory,
  abi,
  functionName: "claimable",
  args: [account.address],
});
const treasuryClaimable = await publicClient.readContract({
  address: factory,
  abi,
  functionName: "claimable",
  args: [FUSED_TREASURY],
});
const reserved = await publicClient.readContract({ address: factory, abi, functionName: "reservedFees" });
console.log(`state ${market.state}`);
console.log(`realQuote ${market.realQuote.toString()}`);
console.log(`reservedFees ${reserved.toString()}`);
console.log(`creatorClaimable ${creatorClaimable.toString()}`);
console.log(`treasuryClaimable ${treasuryClaimable.toString()}`);
if (market.state !== 1) fail("token must remain on curve");
if (creatorClaimable + treasuryClaimable !== reserved) fail("claimable != reservedFees");

const creatorClaim = creatorClaimable / 2n > 0n ? creatorClaimable / 2n : creatorClaimable;
console.log("smoke creator claim");
const claimHash = await walletClient.writeContract({ address: factory, abi, functionName: "claim" });
const claimReceipt = await publicClient.waitForTransactionReceipt({ hash: claimHash });
if (claimReceipt.status !== "success") fail("creator claim failed");
const creatorAfter = await publicClient.readContract({
  address: factory,
  abi,
  functionName: "claimable",
  args: [account.address],
});
console.log(`creatorClaimTx ${claimHash}`);
console.log(`creatorClaimed ${creatorClaimable.toString()}`);
if (creatorAfter !== 0n) fail("creator claimable should be 0 after claim()");

console.log("smoke treasury claimFor");
const treasBefore = treasuryClaimable;
const treasHash = await walletClient.writeContract({
  address: factory,
  abi,
  functionName: "claimFor",
  args: [FUSED_TREASURY],
});
await publicClient.waitForTransactionReceipt({ hash: treasHash });
const treasAfter = await publicClient.readContract({
  address: factory,
  abi,
  functionName: "claimable",
  args: [FUSED_TREASURY],
});
console.log(`treasuryClaimTx ${treasHash}`);
console.log(`treasuryClaimed ${treasBefore.toString()}`);
if (treasAfter !== 0n) fail("treasury claimable should be 0 after claimFor");

const remaining = market.graduationTarget > market.realQuote ? market.graduationTarget - market.realQuote : 0n;
const gross = remaining === 0n ? parseEther("0.001") : (remaining * 10_000n) / 9_900n + 1n;
console.log(`smoke push graduation remaining=${remaining.toString()} gross=${gross.toString()}`);
const gradBuyHash = await walletClient.writeContract({
  address: factory,
  abi,
  functionName: "buy",
  args: [token, 1n, BigInt(Math.floor(Date.now() / 1000) + 600)],
  value: gross,
});
await publicClient.waitForTransactionReceipt({ hash: gradBuyHash });
console.log(`graduationBuyTx ${gradBuyHash}`);

const after = await publicClient.readContract({ address: factory, abi, functionName: "getMarket", args: [token] });
const ready = await publicClient.readContract({ address: factory, abi, functionName: "isGraduationReady", args: [token] });
console.log(`postBuy state ${after.state} ready ${ready} tokenId ${after.tokenId.toString()} realQuote ${after.realQuote.toString()}`);
if (after.state !== 1) fail("must NOT mark graduated without DEX");
if (!ready) fail("isGraduationReady should be true");
if (after.tokenId !== 0n) fail("tokenId must stay 0 without DEX");

try {
  const sim = await publicClient.simulateContract({
    address: factory,
    abi,
    functionName: "graduate",
    args: [token],
    account: account.address,
  });
  fail(`graduate simulation succeeded unexpectedly: ${JSON.stringify(sim.result)}`);
} catch (error) {
  const text = error instanceof Error ? error.message : String(error);
  if (!text.includes("DexUnavailable")) fail(`graduate must revert DexUnavailable, got: ${text.slice(0, 300)}`);
  console.log("graduate reverted DexUnavailable as designed (no fake DEX)");
}

console.log("ARC SMOKE OK");
console.log(JSON.stringify({
  factory,
  locker: ARC_TESTNET_LAUNCH.locker,
  token,
  createTx: createHash,
  buyTx: buyHash,
  sellTx: sellHash,
  creatorClaimTx: claimHash,
  treasuryClaimTx: treasHash,
  graduationBuyTx: gradBuyHash,
  creatorClaimed: creatorClaimable.toString(),
  treasuryClaimed: treasBefore.toString(),
}, null, 2));
void creatorClaim;
