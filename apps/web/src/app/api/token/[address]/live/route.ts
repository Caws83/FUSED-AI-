import { NextResponse } from "next/server";
import type { Hex } from "viem";
import { loadEnv, loadRepoEnv } from "@fused-ai/config";
import { createDatabaseClient } from "@fused-ai/database";
import { STATE_LABEL } from "@fused-ai/blockchain";
import { createChainClient, hydrateLaunchImage, loadOnchainLaunch, readMarketOnFactories } from "../../../../../lib/launches.ts";

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

      if (env.rpcUrl) {
        try {
          const client = createChainClient(env);
          const existing = await db.getLaunch(env.chainId, address);
          const preferred = existing.ok ? existing.value?.factory : null;
          if (client) {
            const found = await readMarketOnFactories(client, address as Hex, env, preferred);
            if (found) {
              const graduated = found.market.state === 2;
              await db.updateMarket({
                chainId: env.chainId,
                token: address as Hex,
                lifecycleState: STATE_LABEL[found.market.state] ?? "UNKNOWN",
                realQuote: found.market.realQuote.toString(),
                graduationTarget: found.market.graduationTarget.toString(),
                circulating: found.market.circulating.toString(),
                priceX18: found.market.priceX18.toString(),
                tokenId: found.market.tokenId > 0n ? found.market.tokenId.toString() : null,
                dexVersion: graduated ? "uniswap_v4" : "curve",
              });
            }
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
