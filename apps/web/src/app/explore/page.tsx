import { EmptyState, LaunchCard, SectionHeader } from "@fused-ai/ui";
import { loadIndexedLaunches } from "../../lib/launches.ts";

export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const launches = await loadIndexedLaunches();
  return (
    <main className="fused-section">
      <div className="fused-wrap">
        <SectionHeader kicker="Explore" title="Launch board" />
        {launches.length === 0 ? (
          <EmptyState title="No launches yet." body="New tokens will land here after they launch onchain." />
        ) : (
          <div className="fused-grid-3">
            {launches.map((launch) => (
              <a key={launch.token} href={`/token/${launch.token}`} style={{ color: "inherit" }}>
                <LaunchCard
                  name={launch.name || "Token"}
                  symbol={launch.symbol || "—"}
                  creator={`${launch.launcher.slice(0, 6)}…${launch.launcher.slice(-4)}`}
                  token={launch.token}
                  txHash={launch.txHash}
                  dexVersion={launch.dexVersion.toUpperCase()}
                  launchState="Locked liquidity"
                  createdAt={launch.createdAt ? new Date(launch.createdAt).toLocaleString() : `block ${launch.blockNumber}`}
                />
              </a>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
