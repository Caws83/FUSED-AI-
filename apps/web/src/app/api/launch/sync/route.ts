import { NextResponse } from "next/server";
import { createPublicClient, http, parseEventLogs, type Hex } from "viem";
import { loadEnv, loadRepoEnv } from "@fused-ai/config";
import { createDatabaseClient } from "@fused-ai/database";
import { LAUNCH_FACTORY_ABI, LAUNCH_TOKEN_ABI } from "@fused-ai/blockchain";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  loadRepoEnv();
  const env = loadEnv();
  const url = new URL(request.url);
  const tx = url.searchParams.get("tx");
  if (!tx || !tx.startsWith("0x") || !env.rpcUrl || !env.chainId || !env.launchFactory) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const client = createPublicClient({
    chain: {
      id: env.chainId,
      name: "fused",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [env.rpcUrl] } },
    },
    transport: http(env.rpcUrl),
  });
  const receipt = await client.getTransactionReceipt({ hash: tx as Hex });
  const launched = parseEventLogs({ abi: LAUNCH_FACTORY_ABI, logs: receipt.logs, eventName: "Launched" })[0];
  if (!launched) return NextResponse.json({ ok: false }, { status: 404 });
  const args = launched.args;
  const block = await client.getBlock({ blockNumber: receipt.blockNumber });
  let name = "";
  let symbol = "";
  try {
    [name, symbol] = await Promise.all([
      client.readContract({ address: args.token, abi: LAUNCH_TOKEN_ABI, functionName: "name" }),
      client.readContract({ address: args.token, abi: LAUNCH_TOKEN_ABI, functionName: "symbol" }),
    ]);
  } catch {
    /* keep empty rather than invent */
  }
  const db = createDatabaseClient(env);
  await db.migrate();
  const saved = await db.upsertLaunch({
    chainId: env.chainId,
    token: args.token,
    name,
    symbol,
    launcher: args.launcher,
    quote: args.quote,
    poolId: args.poolId,
    tokenId: args.tokenId.toString(),
    startTick: Number(args.startTick),
    lpFee: Number(args.lpFee),
    supply: args.supply.toString(),
    metadataURI: args.metadataURI,
    txHash: receipt.transactionHash,
    blockNumber: receipt.blockNumber,
    createdAt: new Date(Number(block.timestamp) * 1000),
    factory: env.launchFactory as Hex,
    locker: (env.launchLocker as Hex | null) ?? null,
    dexVersion: "v4",
  });
  await db.close();
  return NextResponse.json({ ok: saved.ok, token: args.token });
}
