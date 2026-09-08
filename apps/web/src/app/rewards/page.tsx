import { Badge, Card, SectionHeader } from "@fused-ai/ui";
import { loadRuntime } from "../../lib/runtime.ts";

export const dynamic = "force-dynamic";

const CATEGORIES = ["Creator Rewards", "Holder Rewards", "Referral Rewards", "Community Rewards"] as const;

export default async function RewardsPage() {
  const { registry } = await loadRuntime();
  const assets = registry.ok ? registry.value.filter((asset) => asset.enabled) : [];

  return (
    <main className="fused-section">
      <div className="fused-wrap">
        <SectionHeader kicker="Tokenized Rewards" title="Launch memes. Reward with real-world assets." />
        <p style={{ color: "var(--fused-muted)", maxWidth: 680 }}>
          Fused AI is being designed so launches can distribute supported rewards using verified tokenized assets.
        </p>
        <div className="fused-grid-4" style={{ margin: "18px 0" }}>
          {CATEGORIES.map((label) => (
            <Card key={label}>
              <Badge tone="lime">{label}</Badge>
            </Card>
          ))}
        </div>
        {assets.length > 0 ? (
          <div className="fused-grid-3">
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
    </main>
  );
}
