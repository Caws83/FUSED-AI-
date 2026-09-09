#!/usr/bin/env node
/**
 * Local Anvil lifecycle:
 * create → buy → second buy → sell → graduate → locker owns LP → post-grad swap
 */
import { createPublicClient, createWalletClient, http, parseEther, parseEventLogs } from "viem";
import { anvil } from "viem/chains";
import { ANVIL_ACCOUNT_0, ANVIL_ACCOUNT_1, LOCAL_RPC_URL, PERMIT2 } from "./anvil-account.mjs";
import { loadRepoEnv } from "./repo-env.mjs";
import { etchPermit2, getCode } from "./etch-permit2.mjs";
import {
  ERC20_ABI,
  FUSED_FACTORY_ABI,
  LAUNCH_TOKEN_ABI,
  POSITION_MANAGER_ABI,
  toCreateParams,
} from "@fused-ai/blockchain";

loadRepoEnv();
const factory = process.env.LAUNCH_FACTORY_ADDRESS;
const locker = process.env.LAUNCH_LOCKER_ADDRESS;
const posm = process.env.UNISWAP_POSITION_MANAGER_ADDRESS;
if (!factory || !locker || !posm) {
  console.error("Missing local contract addresses. Deploy first.");
  process.exit(1);
}

await etchPermit2(LOCAL_RPC_URL);
const permit2Code = await getCode(PERMIT2);
if (!permit2Code || permit2Code === "0x") {
  console.error("Permit2 has no bytecode on Anvil. Launch cannot succeed.");
  process.exit(1);
}

const chain = { ...anvil, rpcUrls: { default: { http: [LOCAL_RPC_URL] }, public: { http: [LOCAL_RPC_URL] } } };
const publicClient = createPublicClient({ chain, transport: http(LOCAL_RPC_URL) });
const account0 = ANVIL_ACCOUNT_0.address;
const account1 = ANVIL_ACCOUNT_1.address;
const wallet0 = createWalletClient({ account: account0, chain, transport: http(LOCAL_RPC_URL) });
const wallet1 = createWalletClient({ account: account1, chain, transport: http(LOCAL_RPC_URL) });

const deadline = () => BigInt(Math.floor(Date.now() / 1000) + 600);

async function send(wallet, request) {
  const hash = await wallet.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    console.error("tx failed", hash);
    process.exit(1);
  }
  return { hash, receipt };
}

const params = toCreateParams({
  name: "Curve Fuse",
  symbol: "CFUSE",
  metadataURI: "local://e2e-curve",
});
const createdSim = await publicClient.simulateContract({
  address: factory,
  abi: FUSED_FACTORY_ABI,
  functionName: "create",
  args: [params],
  account: account0,
});
const createdTx = await send(wallet0, createdSim.request);
const created = parseEventLogs({ abi: FUSED_FACTORY_ABI, logs: createdTx.receipt.logs, eventName: "Created" })[0];
if (!created) {
  console.error("no Created event");
  process.exit(1);
}
const token = created.args.token;

const buy0 = await publicClient.simulateContract({
  address: factory,
  abi: FUSED_FACTORY_ABI,
  functionName: "buy",
  args: [token, 0n, deadline()],
  value: parseEther("0.03"),
  account: account0,
});
const buy0Tx = await send(wallet0, buy0.request);

const buy1 = await publicClient.simulateContract({
  address: factory,
  abi: FUSED_FACTORY_ABI,
  functionName: "buy",
  args: [token, 0n, deadline()],
  value: parseEther("0.03"),
  account: account1,
});
const buy1Tx = await send(wallet1, buy1.request);

const bal0 = await publicClient.readContract({
  address: token,
  abi: ERC20_ABI,
  functionName: "balanceOf",
  args: [account0],
});
const sellAmt = bal0 / 4n;
const { request: approveReq } = await publicClient.simulateContract({
  address: token,
  abi: ERC20_ABI,
  functionName: "approve",
  args: [factory, sellAmt],
  account: account0,
});
await send(wallet0, approveReq);
const sell = await publicClient.simulateContract({
  address: factory,
  abi: FUSED_FACTORY_ABI,
  functionName: "sell",
  args: [token, sellAmt, 0n, deadline()],
  account: account0,
});
const sellTx = await send(wallet0, sell.request);

const beforeGrad = await publicClient.readContract({
  address: factory,
  abi: FUSED_FACTORY_ABI,
  functionName: "getMarket",
  args: [token],
});
const graduateBuy = await publicClient.simulateContract({
  address: factory,
  abi: FUSED_FACTORY_ABI,
  functionName: "buy",
  args: [token, 0n, deadline()],
  value: parseEther("0.12"),
  account: account0,
});
const gradTx = await send(wallet0, graduateBuy.request);
const graduatedEv = parseEventLogs({ abi: FUSED_FACTORY_ABI, logs: gradTx.receipt.logs, eventName: "Graduated" })[0];
const after = await publicClient.readContract({
  address: factory,
  abi: FUSED_FACTORY_ABI,
  functionName: "getMarket",
  args: [token],
});
if (after.state !== 2) {
  console.error("expected GRADUATED", after);
  process.exit(1);
}
if (!graduatedEv) {
  console.error("no Graduated event");
  process.exit(1);
}
const tokenId = after.tokenId;
const owner = await publicClient.readContract({
  address: posm,
  abi: POSITION_MANAGER_ABI,
  functionName: "ownerOf",
  args: [tokenId],
});
const liquidity = await publicClient.readContract({
  address: posm,
  abi: POSITION_MANAGER_ABI,
  functionName: "getPositionLiquidity",
  args: [tokenId],
});
if (owner.toLowerCase() !== locker.toLowerCase()) {
  console.error("locker does not own LP", { owner, locker });
  process.exit(1);
}
if (liquidity === 0n) {
  console.error("zero liquidity");
  process.exit(1);
}

const post = await publicClient.simulateContract({
  address: factory,
  abi: FUSED_FACTORY_ABI,
  functionName: "buy",
  args: [token, 0n, deadline()],
  value: parseEther("0.01"),
  account: account1,
});
const postTx = await send(wallet1, post.request);
const postTrade = parseEventLogs({ abi: FUSED_FACTORY_ABI, logs: postTx.receipt.logs, eventName: "Trade" })[0];
if (!postTrade || Number(postTrade.args.venue) !== 1) {
  console.error("expected uniswap_v4 trade", postTrade);
  process.exit(1);
}

const name = await publicClient.readContract({ address: token, abi: LAUNCH_TOKEN_ABI, functionName: "name" });
const bytecode = await publicClient.getCode({ address: token });
const report = {
  token,
  name,
  createTx: createdTx.hash,
  firstBuy: buy0Tx.hash,
  secondBuy: buy1Tx.hash,
  sell: sellTx.hash,
  graduationTx: gradTx.hash,
  postGraduationSwap: postTx.hash,
  tokenId: tokenId.toString(),
  lockerOwner: owner,
  expectedLocker: locker,
  liquidity: liquidity.toString(),
  stateBeforeGraduateBuy: Number(beforeGrad.state),
  stateAfter: Number(after.state),
  bytecodeBytes: bytecode ? (bytecode.length - 2) / 2 : 0,
  venueAfterGrad: Number(postTrade.args.venue),
};
console.log(JSON.stringify(report, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2));
if (!bytecode || bytecode === "0x") process.exit(1);
