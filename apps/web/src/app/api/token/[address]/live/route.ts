import { NextResponse } from "next/server";
import { createPublicClient, http, type Hex } from "viem";
import { loadEnv, loadRepoEnv } from "@fused-ai/config";
import { createDatabaseClient } from "@fused-ai/database";
import { FUSED_FACTORY_ABI, STATE_LABEL } from "@fused-ai/blockchain";
import { hydrateLaunchImage, loadOnchainLaunch } from "../../../../../lib/launches.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ address: string }> }) {
  try {
    loadRepoEnv();
    const env = loadEnv();
    const { address } = await params;
    if (!env.chainId || !address?.startsWith("0x")) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    if (env.databaseUrl) {
      const db = createDatabaseClient(env);

      if (env.rpcUrl && env.launchFactory) {
        try {
          const client = createPublicClient({
            chain: {
              id: env.chainId,
              name: "fused",
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
              rpcUrls: { default: { http: [env.rpcUrl] } },
            },
            transport: http(env.rpcUrl),
          });
          const market = await client.readContract({
            address: env.launchFactory as Hex,
            abi: FUSED_FACTORY_ABI,
            functionName: "getMarket",
            args: [address as Hex],
          });
          if (market.state !== 0) {
            const graduated = market.state === 2;
            await db.updateMarket({
              chainId: env.chainId,
              token: address as Hex,
              lifecycleState: STATE_LABEL[market.state] ?? "UNKNOWN",
              realQuote: market.realQuote.toString(),
              graduationTarget: market.graduationTarget.toString(),
              circulating: market.circulating.toString(),
              priceX18: market.priceX18.toString(),
              tokenId: market.tokenId > 0n ? market.tokenId.toString() : null,
              dexVersion: graduated ? "uniswap_v4" : "curve",
            });
          }
        } catch {
          /* keep last indexed row */
        }
      }

      const launch = await db.getLaunch(env.chainId, address);
      const trades = await db.listTrades(env.chainId, address, 40);
      const candles1m = await db.listCandles(env.chainId, address, 60, 180);
      const candles5m = await db.listCandles(env.chainId, address, 300, 180);
      const candles15m = await db.listCandles(env.chainId, address, 900, 180);
      const candles1h = await db.listCandles(env.chainId, address, 3600, 180);
      const stats = await db.tokenStats(env.chainId, address);
      await db.close();

      if (launch.ok && launch.value) {
        const hydrated = hydrateLaunchImage(launch.value, env);
        return NextResponse.json({
          ok: true,
          indexing: false,
          launch: {
            ...hydrated,
            blockNumber: hydrated.blockNumber.toString(),
          },
          trades: trades.ok ? trades.value : [],
          candles: {
            60: candles1m.ok ? candles1m.value : [],
            300: candles5m.ok ? candles5m.value : [],
            900: candles15m.ok ? candles15m.value : [],
            3600: candles1h.ok ? candles1h.value : [],
          },
          stats: stats.ok ? stats.value : { volumeTotal: "0", volume24h: "0", tradeCount: 0, holderCount: 0 },
        });
      }
    }

    const onchain = await loadOnchainLaunch(address);
    if (!onchain) return NextResponse.json({ ok: false }, { status: 404 });
    return NextResponse.json({
      ok: true,
      indexing: true,
      launch: {
        ...onchain,
        blockNumber: onchain.blockNumber.toString(),
      },
      trades: [],
      candles: { 60: [], 300: [], 900: [], 3600: [] },
      stats: { volumeTotal: "0", volume24h: "0", tradeCount: 0, holderCount: 0 },
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
