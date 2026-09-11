import { notFound } from "next/navigation";
import { SectionHeader } from "@fused-ai/ui";
import { loadEnv, loadRepoEnv } from "@fused-ai/config";
import { loadLaunchPage } from "../../../lib/launches.ts";
import { TokenTerminal } from "../../../components/TokenTerminal.tsx";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function TokenPage({ params }: { params: Promise<{ address: string }> }) {
  loadRepoEnv();
  const env = loadEnv();
  const { address } = await params;
  const loaded = await loadLaunchPage(address);
  if (!loaded) notFound();
  const factory =
    env.publicLaunchEnabled && env.launchFactory?.startsWith("0x") ? (env.launchFactory as `0x${string}`) : null;
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
