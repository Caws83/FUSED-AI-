import { EmptyState, SectionHeader } from "@fused-ai/ui";
import { loadIndexedLaunches } from "../../lib/launches.ts";
import { LaunchGrid } from "../../lib/boards.tsx";

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
          <LaunchGrid launches={launches} />
        )}
      </div>
    </main>
  );
}
