import { EmptyState, FusedLogo, PostCard, SectionHeader } from "@fused-ai/ui";
import { formatEngagement } from "@fused-ai/social";
import { QuickFuse } from "../components/QuickFuse.tsx";
import { boardEmptyCopy, loadIndexedLaunches, loadIndexerFreshness } from "../lib/launches.ts";
import { loadTrendingPosts } from "../lib/social.ts";
import { LaunchGrid, splitBoards } from "../lib/boards.tsx";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PIPELINE = [
  { id: "FUSE", caption: "From a post" },
  { id: "CURVE", caption: "Trade the curve" },
  { id: "TRADE", caption: "Live buys and sells" },
  { id: "GRAD", caption: "Graduate to Uniswap" },
] as const;

export default async function HomePage() {
  const launches = await loadIndexedLaunches();
  const freshness = await loadIndexerFreshness(launches.length);
  const posts = await loadTrendingPosts();
  const boards = splitBoards(launches);
  const emptyAll = launches.length === 0 && freshness.indexing;

  return (
    <main>
      <section className="fused-hero">
        <div className="fused-wrap fused-hero-grid">
          <div className="fused-hero-banner">
            <FusedLogo variant="mark" tone="dark" />
            <h1>Launch a token from a post.</h1>
          </div>
          <div className="fused-hero-copy">
            <p className="fused-support">One post. One click. One token.</p>
            <QuickFuse />
            <div className="fused-cta-row">
              <a href="/launch" className="fused-btn fused-btn-ghost">
                Create manually
              </a>
            </div>
          </div>
          <div className="fused-pipeline" aria-label="How Fuse works">
            {PIPELINE.map((step) => (
              <div className="fused-pipeline-step" key={step.id}>
                <div className="fused-pipeline-orb">{step.id.slice(0, 1)}</div>
                <div>
                  <strong>{step.id}</strong>
                  <span>{step.caption}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="fused-section">
        <div className="fused-wrap">
          <SectionHeader kicker="Trending posts" title="Find the conversation. Fuse the moment." />
          {posts.length === 0 ? (
            <EmptyState title="No conversations yet." body="Live posts will appear here as soon as the feed is connected." />
          ) : (
            <div style={{ display: "grid", gap: 16, maxWidth: 720 }}>
              {posts.slice(0, 3).map((post) => (
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
      </section>

      {freshness.indexing ? (
        <section className="fused-section" style={{ paddingBottom: 0 }}>
          <div className="fused-wrap">
            <p className="fused-support">Indexing… Live boards fill from Robinhood Mainnet and Arc Mainnet as the indexer catches up.</p>
          </div>
        </section>
      ) : null}

      <section className="fused-section">
        <div className="fused-wrap">
          <SectionHeader kicker="Live tokens" title="On the bonding curve" />
          {boards.live.length === 0 ? (
            <EmptyState {...boardEmptyCopy(emptyAll, "live")} />
          ) : (
            <LaunchGrid launches={boards.live} />
          )}
        </div>
      </section>

      <section className="fused-section">
        <div className="fused-wrap">
          <SectionHeader kicker="Newly created" title="Just launched" />
          {boards.newly.length === 0 ? (
            <EmptyState {...boardEmptyCopy(emptyAll, "newly")} />
          ) : (
            <LaunchGrid launches={boards.newly} />
          )}
        </div>
      </section>

      <section className="fused-section">
        <div className="fused-wrap">
          <SectionHeader kicker="Graduating" title="Close to Uniswap" />
          {boards.graduating.length === 0 ? (
            <EmptyState {...boardEmptyCopy(emptyAll, "graduating")} />
          ) : (
            <LaunchGrid launches={boards.graduating} />
          )}
        </div>
      </section>

      <section className="fused-section">
        <div className="fused-wrap">
          <SectionHeader kicker="Graduated" title="Trading on Uniswap" />
          {boards.graduated.length === 0 ? (
            <EmptyState {...boardEmptyCopy(emptyAll, "graduated")} />
          ) : (
            <LaunchGrid launches={boards.graduated} />
          )}
        </div>
      </section>
    </main>
  );
}
