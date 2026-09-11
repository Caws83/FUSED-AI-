import { NextResponse } from "next/server";
import { createPublicClient, http, parseEventLogs, type Hex } from "viem";
import { loadEnv, loadRepoEnv } from "@fused-ai/config";
import { createDatabaseClient } from "@fused-ai/database";
import { FUSED_FACTORY_ABI, LAUNCH_FACTORY_ABI, LAUNCH_TOKEN_ABI, STATE_LABEL, ZERO_ADDRESS } from "@fused-ai/blockchain";
import { assertPublicMediaUrl, createMediaStore } from "@fused-ai/media";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    loadRepoEnv();
    const env = loadEnv();
  const url = new URL(request.url);
  let extra: { imageId?: string; sourcePostId?: string; description?: string; tx?: string } = {};
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      extra = (await request.json()) as typeof extra;
    } catch {
      extra = {};
    }
  }
  const tx = url.searchParams.get("tx") ?? extra.tx;
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
  const created = parseEventLogs({ abi: FUSED_FACTORY_ABI, logs: receipt.logs, eventName: "Created" })[0];
  const launched = parseEventLogs({ abi: LAUNCH_FACTORY_ABI, logs: receipt.logs, eventName: "Launched" })[0];
  const token = created?.args.token ?? launched?.args.token;
  const launcher = created?.args.creator ?? launched?.args.launcher;
  const supply = created?.args.supply ?? launched?.args.supply;
  const metadataURI = created?.args.metadataURI ?? launched?.args.metadataURI ?? "";
  if (!token || !launcher) return NextResponse.json({ ok: false }, { status: 404 });

  const block = await client.getBlock({ blockNumber: receipt.blockNumber });
  let name = "";
  let symbol = "";
  try {
    [name, symbol] = await Promise.all([
      client.readContract({ address: token, abi: LAUNCH_TOKEN_ABI, functionName: "name" }),
      client.readContract({ address: token, abi: LAUNCH_TOKEN_ABI, functionName: "symbol" }),
    ]);
  } catch {
    /* keep empty rather than invent */
  }

  let lifecycleState = created ? "CURVE" : "GRADUATED";
  let dexVersion = created ? "curve" : "v4";
  let tokenId = launched?.args.tokenId.toString() ?? "0";
  let poolId = launched?.args.poolId ?? null;
  let graduationTarget = created?.args.graduationTarget.toString() ?? null;
  let realQuote: string | null = null;
  let circulating: string | null = null;
  let priceX18: string | null = null;
  try {
    const market = await client.readContract({
      address: env.launchFactory as Hex,
      abi: FUSED_FACTORY_ABI,
      functionName: "getMarket",
      args: [token],
    });
    if (market.state !== 0) {
      lifecycleState = STATE_LABEL[market.state] ?? lifecycleState;
      dexVersion = market.state === 2 ? "uniswap_v4" : "curve";
      tokenId = market.tokenId > 0n ? market.tokenId.toString() : tokenId;
      graduationTarget = market.graduationTarget.toString();
      realQuote = market.realQuote.toString();
      circulating = market.circulating.toString();
      priceX18 = market.priceX18.toString();
    }
  } catch {
    /* OpenLaunch factory has no getMarket */
  }

  const db = createDatabaseClient(env);
  const migrated = await db.migrate();
  if (!migrated.ok) {
    await db.close();
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  const saved = await db.upsertLaunch({
    chainId: env.chainId,
    token,
    name,
    symbol,
    launcher,
    quote: launched?.args.quote ?? ZERO_ADDRESS,
    poolId,
    tokenId,
    startTick: launched ? Number(launched.args.startTick) : 0,
    lpFee: launched ? Number(launched.args.lpFee) : 0,
    supply: supply?.toString() ?? "0",
    metadataURI,
    txHash: receipt.transactionHash,
    blockNumber: receipt.blockNumber,
    createdAt: new Date(Number(block.timestamp) * 1000),
    factory: env.launchFactory as Hex,
    locker: (env.launchLocker as Hex | null) ?? null,
    dexVersion,
    lifecycleState,
    graduationTarget: graduationTarget ?? undefined,
  });
  if (realQuote != null && graduationTarget != null && circulating != null && priceX18 != null) {
    await db.updateMarket({
      chainId: env.chainId,
      token,
      lifecycleState,
      realQuote,
      graduationTarget,
      circulating,
      priceX18,
      tokenId,
      poolId,
      dexVersion,
    });
  }

  let imageUrl: string | null = null;
  if (extra.imageId) {
    const store = createMediaStore(env);
    const publicUrl = store.getPublicUrl(extra.imageId);
    if (publicUrl && assertPublicMediaUrl(publicUrl, env.chainId).ok) imageUrl = publicUrl;
  }
  let source = {
    sourcePlatform: null as string | null,
    sourcePostId: null as string | null,
    sourceAuthor: null as string | null,
    sourcePostUrl: null as string | null,
    sourceExcerpt: null as string | null,
  };
  if (extra.sourcePostId) {
    const post = await db.getSocialPost("x", extra.sourcePostId);
    if (post.ok && post.value) {
      source = {
        sourcePlatform: post.value.platform,
        sourcePostId: post.value.postId,
        sourceAuthor: post.value.authorUsername,
        sourcePostUrl: post.value.url,
        sourceExcerpt: post.value.text.slice(0, 240),
      };
    }
  }
  try {
    await db.upsertTokenMetadata({
      chainId: env.chainId,
      token,
      description: extra.description ?? metadataURI,
      imageId: extra.imageId ?? null,
      imageUrl,
      ...source,
    });
  } catch {
    /* onchain launch row is already saved */
  }
  await db.close();
  return NextResponse.json({ ok: saved.ok, token });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
