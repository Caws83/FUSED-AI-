import { EmptyState, SectionHeader } from "@fused-ai/ui";
import { loadRuntime } from "../../lib/runtime.ts";

export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const { status } = await loadRuntime();
  return (
    <main className="fused-section">
      <div className="fused-wrap">
        <SectionHeader kicker="Explore" title="Launch board" />
        <EmptyState
          title="Launch indexer not configured."
          body={
            status.indexer.status === "NOT_CONFIGURED"
              ? "Database, RPC, and factory address are required before launches can be listed."
              : "Indexer is not writing launch rows yet. No synthetic tokens are shown."
          }
        />
      </div>
    </main>
  );
}
