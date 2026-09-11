import { EmptyState, SectionHeader } from "@fused-ai/ui";
import { boardEmptyCopy, loadIndexedLaunches, loadIndexerFreshness } from "../../lib/launches.ts";
import { LaunchGrid } from "../../lib/boards.tsx";

export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const launches = await loadIndexedLaunches();
  const freshness = await loadIndexerFreshness(launches.length);
  const empty = launches.length === 0;
  return (
    <main className="fused-section">
      <div className="fused-wrap">
        <SectionHeader kicker="Explore" title="Launch board" />
        {freshness.indexing ? (
          <p className="fused-support">Indexing… Tokens already onchain appear here after the indexer catches up.</p>
        ) : null}
        {empty ? (
          <EmptyState {...boardEmptyCopy(freshness.indexing, "newly")} />
        ) : (
          <LaunchGrid launches={launches} />
        )}
      </div>
    </main>
  );
}
