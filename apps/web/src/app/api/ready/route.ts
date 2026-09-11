import { NextResponse } from "next/server";
import { loadEnv, loadRepoEnv, systemStatus } from "@fused-ai/config";
import { loadIndexerFreshness } from "../../../lib/launches.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  loadRepoEnv();
  const env = loadEnv();
  const status = systemStatus(env);
  const freshness = await loadIndexerFreshness();
  return NextResponse.json({
    status: freshness.indexing ? "indexing" : "ok",
    service: "FUSED AI Web",
    chainId: env.chainId,
    blockchain: status.rpc.status === "OK" && status.launchContracts.status === "OK",
    database: status.database.status === "OK",
    media: status.media.status === "OK",
    indexer: {
      configured: status.indexer.status === "OK",
      latestIndexedBlock: freshness.latestIndexedBlock?.toString() ?? null,
      latestRpcBlock: freshness.latestRpcBlock?.toString() ?? null,
      lag: freshness.lag,
      indexing: freshness.indexing,
    },
    publicLaunchEnabled: env.publicLaunchEnabled,
  });
}
