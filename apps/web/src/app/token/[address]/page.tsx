import { notFound } from "next/navigation";
import { SectionHeader } from "@fused-ai/ui";
import { loadEnv, loadRepoEnv } from "@fused-ai/config";
import { loadIndexedLaunch } from "../../../lib/launches.ts";
import { TokenTerminal } from "../../../components/TokenTerminal.tsx";

export const dynamic = "force-dynamic";

export default async function TokenPage({ params }: { params: Promise<{ address: string }> }) {
  loadRepoEnv();
  const env = loadEnv();
  const { address } = await params;
  const launch = await loadIndexedLaunch(address);
  if (!launch) notFound();
  const factory =
    env.publicLaunchEnabled && env.launchFactory?.startsWith("0x") ? (env.launchFactory as `0x${string}`) : null;
  return (
    <main className="fused-section">
      <div className="fused-wrap" style={{ maxWidth: 1180 }}>
        <SectionHeader kicker="Token" title={launch.name || launch.symbol || "Token"} />
        <TokenTerminal
          initial={launch}
          factory={factory}
          chainId={launch.chainId}
          graduationTargetUsd={env.graduationTargetUsdDisplay}
        />
      </div>
    </main>
  );
}
