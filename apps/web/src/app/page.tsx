import { Badge, Card, EmptyState, FusedLogo, SectionHeader } from "@fused-ai/ui";
import { QuickFuse } from "../components/QuickFuse.tsx";
import { loadRuntime } from "../lib/runtime.ts";

export const dynamic = "force-dynamic";

const PIPELINE = [
  { id: "POST", caption: "See the moment" },
  { id: "AI", caption: "Draft the launch" },
  { id: "REVIEW", caption: "You stay in control" },
  { id: "LAUNCH", caption: "Token, live" },
] as const;

const FEATURES = [
  { title: "Instant Launch", body: "From a public post to an onchain token in one flow." },
  { title: "AI Assisted", body: "A draft you review — never a transaction you did not sign." },
  { title: "Social Discovery", body: "Find the conversation. Fuse the moment." },
  { title: "Tokenized Rewards", body: "Route value through verified real-world assets." },
  { title: "Locked Liquidity", body: "Supply is locked as LP. Nobody rugs the pool." },
  { title: "Multi-DEX Architecture", body: "Built to plug in additional DEX versions over time." },
] as const;

const REWARD_CATEGORIES = ["Creator Rewards", "Holder Rewards", "Referral Rewards", "Community Rewards"] as const;

export default async function HomePage() {
  const { registry } = await loadRuntime();
  const assets = registry.ok ? registry.value.filter((asset) => asset.enabled) : [];

  return (
    <main>
      <section className="fused-hero">
        <div className="fused-wrap fused-hero-grid">
          <div>
            <FusedLogo variant="mark" tone="dark" />
            <h1>
              Launch a token
              <br />
              from a post.
            </h1>
            <p className="fused-support">One post. One click. One token.</p>
            <QuickFuse ready={false} />
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
          <SectionHeader kicker="Trending" title="Find the conversation. Fuse the moment." />
          <EmptyState title="Trending launches coming soon." body="Live posts will appear here as soon as the feed is connected." />
        </div>
      </section>

      <section className="fused-section">
        <div className="fused-wrap">
          <SectionHeader kicker="Built for the next generation of onchain launches" title="See a post. Fuse it. Launch it." />
          <div className="fused-grid-3">
            {FEATURES.map((feature) => (
              <Card key={feature.title}>
                <div className="fused-feature-icon">{feature.title.slice(0, 1)}</div>
                <strong>{feature.title}</strong>
                <p style={{ margin: "8px 0 0", color: "var(--fused-muted)" }}>{feature.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="fused-section">
        <div className="fused-wrap">
          <SectionHeader kicker="Tokenized Rewards" title="Launch memes. Reward with real-world assets." />
          <p style={{ marginTop: -8, color: "var(--fused-muted)", maxWidth: 640 }}>
            Fused AI is being designed so launches can distribute supported rewards using verified tokenized
            assets.
          </p>
          <div className="fused-grid-4" style={{ margin: "18px 0 0" }}>
            {REWARD_CATEGORIES.map((label) => (
              <Card key={label}>
                <Badge tone="lime">{label}</Badge>
              </Card>
            ))}
          </div>
          {assets.length > 0 ? (
            <div className="fused-grid-3" style={{ marginTop: 18 }}>
              {assets.map((asset) => (
                <Card key={`${asset.chainId}:${asset.contractAddress}`}>
                  <strong>
                    {asset.name} <span style={{ color: "var(--fused-muted)" }}>{asset.symbol}</span>
                  </strong>
                  <div style={{ color: "var(--fused-muted)", fontSize: 13 }}>
                    {asset.issuer} · chain {asset.chainId}
                  </div>
                </Card>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="fused-section">
        <div className="fused-wrap">
          <SectionHeader kicker="Explore" title="New launches" />
          <EmptyState title="No launches yet." body="The board fills as real launches land onchain." />
        </div>
      </section>
    </main>
  );
}
