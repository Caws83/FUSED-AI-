import { EmptyState, SectionHeader } from "@fused-ai/ui";

export const dynamic = "force-dynamic";

export default function ExplorePage() {
  return (
    <main className="fused-section">
      <div className="fused-wrap">
        <SectionHeader kicker="Explore" title="Launch board" />
        <EmptyState title="No launches yet." body="New tokens will land here after they launch onchain." />
      </div>
    </main>
  );
}
