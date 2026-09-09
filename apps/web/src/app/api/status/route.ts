import { NextResponse } from "next/server";
import { isStatusPageEnabled, loadEnv, loadRepoEnv, systemStatus } from "@fused-ai/config";
import { listDexAdapters } from "@fused-ai/blockchain";

export const dynamic = "force-dynamic";

export function GET() {
  loadRepoEnv();
  if (!isStatusPageEnabled()) {
    return NextResponse.json({ status: "not_found" }, { status: 404 });
  }
  const env = loadEnv();
  const status = systemStatus(env);
  return NextResponse.json({
    status: {
      database: status.database.status,
      rpc: status.rpc.status,
      social: status.social.status,
      media: status.media.status,
      walletConnect: status.walletConnect.status,
      ai: status.ai.status,
      aiImage: status.aiImage.status,
      launchContracts: status.launchContracts.status,
      indexer: status.indexer.status,
      wallet: status.wallet.status,
      publicLaunchEnabled: env.publicLaunchEnabled,
      publicChainConfigured: env.publicChainConfigured,
      invalid: status.invalid,
    },
    dex: listDexAdapters(env).map((a) => ({ version: a.info().version, available: a.info().available })),
  });
}
