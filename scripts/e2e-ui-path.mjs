#!/usr/bin/env node
/**
 * Same transaction path as ManualLaunch.onLaunch / TradePanel.submit:
 * simulateContract → writeContract → waitForTransactionReceipt.
 * Uses Anvil keys (local only). Does not click MetaMask.
 */
import { createPublicClient, createWalletClient, http, parseEther, parseEventLogs, formatEther } from "viem";
import { anvil } from "viem/chains";
import { ANVIL_ACCOUNT_0, ANVIL_ACCOUNT_1, LOCAL_RPC_URL } from "./anvil-account.mjs";
import { loadRepoEnv } from "./repo-env.mjs";
import { ERC20_ABI, FUSED_FACTORY_ABI, toCreateParams } from "@fused-ai/blockchain";

loadRepoEnv();
const factory = process.env.LAUNCH_FACTORY_ADDRESS;
const locker = process.env.LAUNCH_LOCKER_ADDRESS;
if (!factory || !locker) {
  console.error("Missing LAUNCH_FACTORY_ADDRESS / LAUNCH_LOCKER_ADDRESS");
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

const chainId = await publicClient.getChainId();
const bytecode = await publicClient.getCode({ address: factory });
const stateCurve = await publicClient.readContract({
  address: factory,
  abi: FUSED_FACTORY_ABI,
  functionName: "STATE_CURVE",
});
const onchainLocker = await publicClient.readContract({
  address: factory,
  abi: FUSED_FACTORY_ABI,
  functionName: "locker",
});
const feeBps = await publicClient.readContract({
  address: factory,
  abi: FUSED_FACTORY_ABI,
  functionName: "feeBps",
});
const graduationTarget = await publicClient.readContract({
  address: factory,
  abi: FUSED_FACTORY_ABI,
  functionName: "graduationTarget",
});

const launchParams = toCreateParams({
  name: "Audit Curve",
  symbol: "ACRV",
  metadataURI: "local://phase5-wallet-audit",
});
const creatorBuy = parseEther("0.02");
const createdSim = await publicClient.simulateContract({
  address: factory,
  abi: FUSED_FACTORY_ABI,
  functionName: "create",
  args: [launchParams],
  account: account0,
  value: creatorBuy,
});
const createdTx = await send(wallet0, createdSim.request);
const created = parseEventLogs({ abi: FUSED_FACTORY_ABI, logs: createdTx.receipt.logs, eventName: "Created" })[0];
const tradesAtCreate = parseEventLogs({ abi: FUSED_FACTORY_ABI, logs: createdTx.receipt.logs, eventName: "Trade" });
if (!created) {
  console.error("no Created event");
  process.exit(1);
}
const token = created.args.token;
const afterCreate = await publicClient.readContract({
  address: factory,
  abi: FUSED_FACTORY_ABI,
  functionName: "getMarket",
  args: [token],
});
const creatorBal = await publicClient.readContract({
  address: token,
  abi: ERC20_ABI,
  functionName: "balanceOf",
  args: [account0],
});

const buy1 = await publicClient.simulateContract({
  address: factory,
  abi: FUSED_FACTORY_ABI,
  functionName: "buy",
  args: [token, 0n, deadline()],
  value: parseEther("0.03"),
  account: account1,
});
const buy1Tx = await send(wallet1, buy1.request);
const afterBuy = await publicClient.readContract({
  address: factory,
  abi: FUSED_FACTORY_ABI,
  functionName: "getMarket",
  args: [token],
});
const buyerBal = await publicClient.readContract({
  address: token,
  abi: ERC20_ABI,
  functionName: "balanceOf",
  args: [account1],
});

const sellAmt = buyerBal / 5n;
const { request: approveReq } = await publicClient.simulateContract({
  address: token,
  abi: ERC20_ABI,
  functionName: "approve",
  args: [factory, sellAmt],
  account: account1,
});
await send(wallet1, approveReq);
const sell = await publicClient.simulateContract({
  address: factory,
  abi: FUSED_FACTORY_ABI,
  functionName: "sell",
  args: [token, sellAmt, 0n, deadline()],
  account: account1,
});
const sellTx = await send(wallet1, sell.request);
const afterSell = await publicClient.readContract({
  address: factory,
  abi: FUSED_FACTORY_ABI,
  functionName: "getMarket",
  args: [token],
});

console.log(
  JSON.stringify(
    {
      chainId,
      factory,
      lockerEnv: locker,
      lockerOnchain: onchainLocker,
      lockerMatch: onchainLocker.toLowerCase() === locker.toLowerCase(),
      factoryBytecodeBytes: bytecode ? (bytecode.length - 2) / 2 : 0,
      stateCurve: Number(stateCurve),
      feeBps: Number(feeBps),
      graduationTarget: graduationTarget.toString(),
      creator: account0,
      buyer: account1,
      createTx: createdTx.hash,
      createStatus: createdTx.receipt.status,
      token,
      creatorBuyWei: creatorBuy.toString(),
      creatorBuyTrades: tradesAtCreate.length,
      stateAfterCreate: Number(afterCreate.state),
      realQuoteAfterCreate: afterCreate.realQuote.toString(),
      circulatingAfterCreate: afterCreate.circulating.toString(),
      creatorTokenBalance: creatorBal.toString(),
      priceX18AfterCreate: afterCreate.priceX18.toString(),
      progressBpsAfterCreate: afterCreate.progressBps.toString(),
      secondBuyTx: buy1Tx.hash,
      buyerTokenBalance: buyerBal.toString(),
      realQuoteAfterBuy: afterBuy.realQuote.toString(),
      priceX18AfterBuy: afterBuy.priceX18.toString(),
      progressBpsAfterBuy: afterBuy.progressBps.toString(),
      sellTx: sellTx.hash,
      sellAmt: sellAmt.toString(),
      realQuoteAfterSell: afterSell.realQuote.toString(),
      priceX18AfterSell: afterSell.priceX18.toString(),
      ethRaisedAfterSell: formatEther(afterSell.realQuote),
    },
    (_, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  ),
);
