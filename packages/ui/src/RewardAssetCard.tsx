import { Badge } from "./Badge.tsx";

export type RewardAssetCardProps = {
  name: string;
  symbol: string;
  issuer: string;
  category: string;
  contractLabel?: string;
};

export function RewardAssetCard({ name, symbol, issuer, category, contractLabel }: RewardAssetCardProps) {
  return (
    <article className="fused-card fused-reward">
      <Badge tone="lime">{category}</Badge>
      <strong>
        {name} <span style={{ color: "var(--fused-muted)" }}>{symbol}</span>
      </strong>
      <span style={{ color: "var(--fused-muted)", fontSize: 14 }}>Issuer: {issuer}</span>
      {contractLabel ? (
        <code style={{ fontSize: 12, color: "var(--fused-navy)" }}>{contractLabel}</code>
      ) : null}
    </article>
  );
}
