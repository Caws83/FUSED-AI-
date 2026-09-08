import { Badge, Card, EmptyState, SectionHeader } from "@fused-ai/ui";
import { loadRuntime } from "../../lib/runtime.ts";

export const dynamic = "force-dynamic";

const CATEGORIES = ["Creator Rewards", "Holder Rewards", "Referral Rewards", "Community Rewards"] as const;

export default async function RewardsPage() {
  const { status, registry } = await loadRuntime();
  const assets = registry.ok ? registry.value : [];
  const registryConfigured = status.tokenizedAssetRegistry.status === "OK";

  return (
    <main className="fused-section">
      <div className="fused-wrap">
        <SectionHeader kicker="Rewards" title="Tokenized Stock Rewards" />
        <p style={{ color: "var(--fused-muted)", maxWidth: 680 }}>
          Creators will be able to configure supported reward assets from a verified tokenized-asset registry.
          Nothing is listed until that allowlist contains verified chain + contract entries.
        </p>
        <div className="fused-grid-4" style={{ margin: "18px 0" }}>
          {CATEGORIES.map((label) => (
            <Card key={label}>
              <Badge tone="lime">{label}</Badge>
            </Card>
          ))}
        </div>
        {!registryConfigured || assets.length === 0 ? (
          <EmptyState
            title="No verified tokenized assets configured."
            body="Do not infer AAPL, TSLA, or any ticker. Add verified addresses to the registry file first."
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
    </main>
  );
}
