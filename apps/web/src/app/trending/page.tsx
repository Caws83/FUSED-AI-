import { SectionHeader } from "@fused-ai/ui";
import { FeedComposer } from "../../components/FeedComposer.tsx";
import { FeedPosts } from "../../components/FeedPosts.tsx";
import { loadFusedFeedPosts } from "../../lib/social.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function TrendingPage() {
  const posts = await loadFusedFeedPosts();

  return (
    <main>
      <section className="fused-section">
        <div className="fused-wrap">
          <SectionHeader kicker="FUSED FEED" title="Find the conversation. Fuse the moment." />
          <FeedComposer />
          <FeedPosts posts={posts} />
        </div>
      </section>
    </main>
  );
}
