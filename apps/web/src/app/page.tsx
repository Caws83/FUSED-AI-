import { Badge, Card, EmptyState, SectionHeader } from "@fused-ai/ui";
import { QuickFuse } from "../components/QuickFuse.tsx";
import { LaunchModes } from "../components/LaunchModes.tsx";
import { loadRuntime } from "../lib/runtime.ts";

export const dynamic = "force-dynamic";

const FLOW = [
  { id: "POST", caption: "Paste a public post" },
  { id: "AI", caption: "Draft name, ticker, art" },
  { id: "REVIEW", caption: "You check the details" },
  { id: "SIGN", caption: "Wallet signs the launch" },
  { id: "LAUNCH", caption: "Token + locked LP" },
] as const;

export default async function HomePage() {
  const { status, dex, social, registry } = await loadRuntime();
  const assets = registry.ok ? registry.value : [];
  const registryConfigured = status.tokenizedAssetRegistry.status === "OK";

  return (
    <main>
      <section className="fused-hero">
        <div className="fused-wrap fused-hero-grid">
          <div>
            <p className="fused-kicker">FUSED AI</p>
            <h1>Launch a token from a post.</h1>
            <p className="fused-support">
              <span>One post.</span>
              <span>One click.</span>
              <span>One token.</span>
            </p>
            <div className="fused-cta-row">
              <a href="#quick-fuse" className="fused-btn fused-btn-lime fused-btn-lg">
                Fuse a Post
              </a>
              <a href="/launch" className="fused-btn fused-btn-ghost fused-btn-lg">
                Create Manually
              </a>
            </div>
          </div>
          <Card>
            <p className="fused-kicker">Launch flow</p>
            <div className="fused-flow">
              {FLOW.map((step, index) => (
                <div className="fused-flow-step" key={step.id}>
                  <div className="fused-flow-index">
                    {index + 1 < FLOW.length ? `${step.id}` : step.id}
                  </div>
                  <div>
                    <strong>{step.id}</strong>
                    <div>
                      <small>{step.caption}</small>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      <section className="fused-section" id="quick-fuse">
        <div className="fused-wrap">
          <SectionHeader kicker="Quick Fuse" title="Paste an X post URL" />
          <QuickFuse socialStatus={social.status} />
        </div>
      </section>

      <section className="fused-section">
        <div className="fused-wrap">
          <SectionHeader kicker="Trending" title="Live posts, when a provider exists" />
          <EmptyState
            title="Trending feed unavailable"
            body="Connect a social provider to load live posts."
          />
        </div>
      </section>

      <section className="fused-section">
        <div className="fused-wrap">
          <SectionHeader kicker="Launch options" title="DEX adapters from the registry" />
          <LaunchModes adapters={dex} />
        </div>
      </section>

      <section className="fused-section">
        <div className="fused-wrap">
          <SectionHeader kicker="Tokenized Stock Rewards" title="Verified assets only" />
          <p style={{ marginTop: -8, color: "var(--fused-muted)", maxWidth: 640 }}>
            Creators will be able to configure supported reward assets from a verified tokenized-asset
            registry.
          </p>
          <div className="fused-grid-4" style={{ margin: "18px 0" }}>
            {["Creator Rewards", "Holder Rewards", "Referral Rewards", "Community Rewards"].map((label) => (
              <Card key={label}>
                <Badge tone="blue">{label}</Badge>
                <p style={{ margin: "12px 0 0", color: "var(--fused-muted)", fontSize: 14 }}>
                  Route later, once allowlisted contracts exist.
                </p>
              </Card>
            ))}
          </div>
          {!registryConfigured || assets.length === 0 ? (
            <EmptyState
              title="No verified tokenized assets configured."
              body="The registry is empty or not configured. Tickers are never inferred."
            />
          ) : (
            <div className="fused-grid-3">
              {assets.map((asset) => (
                <Card key={`${asset.chainId}:${asset.contractAddress}`}>
                  <strong>
                    {asset.name} <span style={{ color: "var(--fused-muted)" }}>{asset.symbol}</span>
                  </strong>
                  <div style={{ color: "var(--fused-muted)", fontSize: 13 }}>
                    {asset.issuer} · chain {asset.chainId}
                  </div>
                  <code style={{ fontSize: 12 }}>{asset.contractAddress}</code>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="fused-section">
        <div className="fused-wrap">
          <SectionHeader kicker="Explore" title="Launch board" />
          <EmptyState
            title="Launch indexer not configured."
            body="When the indexer and database are live, launches will appear here from chain events."
          />
        </div>
      </section>
    </main>
  );
}
