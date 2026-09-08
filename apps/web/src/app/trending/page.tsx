import { EmptyState, SectionHeader } from "@fused-ai/ui";
import { loadRuntime } from "../../lib/runtime.ts";

export const dynamic = "force-dynamic";

export default async function TrendingPage() {
  const { social } = await loadRuntime();
  return (
    <main className="fused-section">
      <div className="fused-wrap">
        <SectionHeader kicker="Trending" title="What people are posting" />
        <EmptyState
          title="Trending feed unavailable"
          body={
            social.status === "OK"
              ? "A social provider is selected, but live ingestion is not implemented. No posts were loaded."
              : "Connect a social provider to load live posts."
          }
        />
      </div>
    </main>
  );
}
