import { EmptyState, PostCard, SectionHeader } from "@fused-ai/ui";
import { formatEngagement } from "@fused-ai/social";
import { loadTrendingPosts } from "../../lib/social.ts";

export const dynamic = "force-dynamic";

export default async function TrendingPage() {
  const posts = await loadTrendingPosts();
  return (
    <main className="fused-section">
      <div className="fused-wrap" style={{ display: "grid", gap: 22 }}>
        <SectionHeader title="TRENDING" />
        <p style={{ marginTop: -8, color: "var(--fused-muted)" }}>Find the conversation. Fuse the moment.</p>
        {posts.length === 0 ? (
          <EmptyState
            title="No conversations yet."
            body="Live posts will appear here as soon as the feed is connected."
          />
        ) : (
          <div style={{ display: "grid", gap: 16, maxWidth: 720 }}>
            {posts.map((post) => (
              <PostCard
                key={post.postId}
                author={post.authorDisplayName || post.authorUsername}
                username={post.authorUsername}
                text={post.text}
                timestamp={new Date(post.publishedAt).toLocaleString()}
                engagement={formatEngagement(post)}
                avatarUrl={post.avatarUrl}
                verified={post.verified}
                mediaUrl={post.media.find((m) => m.type === "photo")?.url}
                fuseDisabled={false}
                fuseHref={`/launch?post=${encodeURIComponent(post.postId)}`}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
