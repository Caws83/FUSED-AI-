import { Badge, Card, SectionHeader } from "@fused-ai/ui";

export const dynamic = "force-dynamic";

const PHASES = [
  {
    phase: "Phase 1",
    status: "Completed",
    tone: "green" as const,
    title: "App live on Robinhood Chain",
    body: "FUSED is live on Robinhood Chain. Fuse a post, launch a token, and trade the bonding curve.",
  },
  {
    phase: "Phase 2",
    status: "Next",
    tone: "blue" as const,
    title: "Token launch on Robinhood",
    body: "The FUSED token launches on Robinhood Chain.",
  },
  {
    phase: "Phase 3",
    status: "Later",
    tone: "muted" as const,
    title: "Launch on Arc Chain",
    body: "FUSED launches on Arc Chain. Fuse posts, launch tokens, and trade on a new network.",
  },
  {
    phase: "Phase 4",
    status: "Later",
    tone: "muted" as const,
    title: "X Money creator rewards",
    body: "A share of trading fees paid to the original post creator, sent directly through X Money.",
  },
  {
    phase: "Phase 5",
    status: "Later",
    tone: "muted" as const,
    title: "NFTs from posts",
    body: "Fuse a post into an NFT. AI creates the art, inspired by the post content.",
  },
] as const;

export default function RoadmapPage() {
  return (
    <main className="fused-section">
      <div className="fused-wrap" style={{ display: "grid", gap: 22 }}>
        <SectionHeader kicker="Roadmap" title="What ships next." />
        <p style={{ color: "var(--fused-muted)", maxWidth: 680, margin: 0 }}>
          Five phases. The app is already live on Robinhood Chain. Next is the FUSED token, then Arc, X Money
          creator rewards, and NFTs from posts.
        </p>
        <div className="fused-grid-3">
          {PHASES.map((item) => (
            <Card key={item.phase} data-roadmap-phase={item.phase}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <p className="fused-kicker" style={{ margin: 0 }}>
                  {item.phase}
                </p>
                <Badge tone={item.tone}>{item.status}</Badge>
              </div>
              <h3 className="fused-h2" style={{ fontSize: 22, margin: "12px 0 8px" }}>
                {item.title}
              </h3>
              <p style={{ color: "var(--fused-muted)", margin: 0 }}>{item.body}</p>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
