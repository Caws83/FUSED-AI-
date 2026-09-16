import { NextResponse } from "next/server";
import type { Hex } from "viem";
import { loadEnv, loadRepoEnv, parseSupportedChainId } from "@fused-ai/config";
import { fetchEthUsd } from "../../../../../lib/eth-usd.ts";
import { createDatabaseClient } from "@fused-ai/database";
import { STATE_LABEL } from "@fused-ai/blockchain";
import {
  createChainClientFor,
  hydrateLaunchImage,
  launchGenerationsForChain,
  loadOnchainLaunch,
  readMarketOnFactories,
  resolveLaunchIdentity,
  rpcUrlForLaunchChain,
} from "../../../../../lib/launches.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ address: string }> }) {
  try {
    loadRepoEnv();
    const env = loadEnv();
    const { address } = await params;
    if (!address?.startsWith("0x")) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    const url = new URL(request.url);
    const requestedChainId = parseSupportedChainId(url.searchParams.get("chainId"));

    if (env.databaseUrl) {
      const db = createDatabaseClient(env);
      const listed = requestedChainId != null ? await db.getLaunch(requestedChainId, address) : await db.findLaunchesByToken(address);
      const rows = listed.ok ? (Array.isArray(listed.value) ? listed.value : listed.value ? [listed.value] : []) : [];
      const identity = resolveLaunchIdentity(rows, requestedChainId);
      if (identity.status === "ambiguous") {
        await db.close();
        return NextResponse.json({ ok: false, reason: "ambiguous" }, { status: 409 });
      }
      const chainId = identity.status === "found" ? identity.launch.chainId : requestedChainId;
      const preferred = identity.status === "found" ? identity.launch.factory : null;

      if (chainId && env.rpcUrl !== undefined) {
        try {
          const rpcUrl = rpcUrlForLaunchChain(chainId, env);
          const gens = launchGenerationsForChain(chainId, env);
          if (rpcUrl && gens.length > 0) {
            const client = createChainClientFor(chainId, rpcUrl);
            const found = await readMarketOnFactories(client, address as Hex, gens, preferred);
            if (found) {
              const graduated = found.market.state === 2;
              await db.updateMarket({
                chainId,
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

      const launch = chainId ? await db.getLaunch(chainId, address) : { ok: true as const, value: null };
      const trades = chainId ? await db.listTrades(chainId, address, 40) : { ok: true as const, value: [] };
      const candles1m = chainId ? await db.listCandles(chainId, address, 60, 180) : { ok: true as const, value: [] };
      const candles5m = chainId ? await db.listCandles(chainId, address, 300, 180) : { ok: true as const, value: [] };
      const candles15m = chainId ? await db.listCandles(chainId, address, 900, 180) : { ok: true as const, value: [] };
      const candles1h = chainId ? await db.listCandles(chainId, address, 3600, 180) : { ok: true as const, value: [] };
      const stats = chainId ? await db.tokenStats(chainId, address) : { ok: true as const, value: { volumeTotal: "0", volume24h: "0", tradeCount: 0, holderCount: 0 } };
      const ethUsd = await fetchEthUsd();
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
          ethUsd,
        });
      }
    }

    const onchain = await loadOnchainLaunch(address, null, requestedChainId);
    if (!onchain) return NextResponse.json({ ok: false }, { status: 404 });
    const ethUsd = await fetchEthUsd();
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
      ethUsd,
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
