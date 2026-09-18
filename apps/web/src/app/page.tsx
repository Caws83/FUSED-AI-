import { EmptyState, FusedLogo, SectionHeader } from "@fused-ai/ui";
import { QuickFuse } from "../components/QuickFuse.tsx";
import { FeedPosts } from "../components/FeedPosts.tsx";
import { boardEmptyCopy, loadIndexedLaunches, loadIndexerFreshness } from "../lib/launches.ts";
import { loadFusedFeedPosts } from "../lib/social.ts";
import { LaunchGrid, splitBoards } from "../lib/boards.tsx";
import { fetchEthUsd } from "../lib/eth-usd.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PIPELINE = [
  { step: 1, before: "FUSE from", mark: "/brand/x-logo.png", after: "post" },
  { step: 2, label: "TRADE the curve" },
  { step: 3, before: "GRADUATE to", mark: "/brand/uniswap-logo.png", after: "Uniswap" },
] as const;

export default async function HomePage() {
  const launches = await loadIndexedLaunches();
  const freshness = await loadIndexerFreshness(launches.length);
  const posts = await loadFusedFeedPosts();
  const boards = splitBoards(launches);
  const emptyAll = launches.length === 0 && freshness.indexing;
  const ethUsd = await fetchEthUsd();

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
            {PIPELINE.map((item) => (
              <div className="fused-pipeline-step" key={item.step}>
                <div className="fused-pipeline-orb">{item.step}</div>
                <strong>
                  {"label" in item ? (
                    item.label
                  ) : (
                    <>
                      <span>{item.before}</span>
                      <span className="fused-pipeline-word">
                        <img src={item.mark} alt="" className="fused-pipeline-mark" />
                        <span>{item.after}</span>
                      </span>
                    </>
                  )}
                </strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="fused-section">
        <div className="fused-wrap">
          <SectionHeader kicker="FUSED feed" title="Find the conversation. Fuse the moment." />
          <FeedPosts posts={posts.slice(0, 4)} layout="grid" />
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
            <LaunchGrid launches={boards.live} ethUsd={ethUsd} />
          )}
        </div>
      </section>

      <section className="fused-section">
        <div className="fused-wrap">
          <SectionHeader kicker="Newly created" title="Just launched" />
          {boards.newly.length === 0 ? (
            <EmptyState {...boardEmptyCopy(emptyAll, "newly")} />
          ) : (
            <LaunchGrid launches={boards.newly} ethUsd={ethUsd} />
          )}
        </div>
      </section>

      <section className="fused-section">
        <div className="fused-wrap">
          <SectionHeader kicker="Graduating" title="Close to Uniswap" />
          {boards.graduating.length === 0 ? (
            <EmptyState {...boardEmptyCopy(emptyAll, "graduating")} />
          ) : (
            <LaunchGrid launches={boards.graduating} ethUsd={ethUsd} />
          )}
        </div>
      </section>

      <section className="fused-section">
        <div className="fused-wrap">
          <SectionHeader kicker="Graduated" title="Trading on Uniswap" />
          {boards.graduated.length === 0 ? (
            <EmptyState {...boardEmptyCopy(emptyAll, "graduated")} />
          ) : (
            <LaunchGrid launches={boards.graduated} ethUsd={ethUsd} />
          )}
        </div>
      </section>
    </main>
  );
}
