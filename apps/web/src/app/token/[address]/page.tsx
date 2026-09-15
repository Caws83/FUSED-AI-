import { notFound } from "next/navigation";
import { SectionHeader } from "@fused-ai/ui";
import { loadEnv, loadRepoEnv, parseSupportedChainId } from "@fused-ai/config";
import { loadLaunchPage, tradeFactoryAddress } from "../../../lib/launches.ts";
import { TokenTerminal } from "../../../components/TokenTerminal.tsx";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function TokenPage({
  params,
  searchParams,
}: {
  params: Promise<{ address: string }>;
  searchParams: Promise<{ chainId?: string }>;
}) {
  loadRepoEnv();
  const env = loadEnv();
  const { address } = await params;
  const query = await searchParams;
  const loaded = await loadLaunchPage(address, parseSupportedChainId(query.chainId));
  if (!loaded) notFound();
  const factory = env.publicLaunchEnabled ? tradeFactoryAddress(loaded.launch, env) : null;
  return (
    <main className="fused-section">
      <div className="fused-wrap" style={{ maxWidth: 1180 }}>
        <SectionHeader kicker="Token" title={loaded.launch.name || loaded.launch.symbol || "Token"} />
        <TokenTerminal
          initial={loaded.launch}
          factory={factory}
          chainId={loaded.launch.chainId}
          graduationTargetUsd={env.graduationTargetUsdDisplay}
          indexing={!loaded.indexed}
        />
      </div>
    </main>
  );
}
