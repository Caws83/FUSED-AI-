import { EmptyState, SectionHeader } from "@fused-ai/ui";

export const dynamic = "force-dynamic";

export default function TrendingPage() {
  return (
    <main className="fused-section">
      <div className="fused-wrap">
        <SectionHeader kicker="Trending" title="Find the conversation. Fuse the moment." />
        <EmptyState title="Trending launches coming soon." body="Live posts will appear here as soon as the feed is connected." />
      </div>
    </main>
  );
}
