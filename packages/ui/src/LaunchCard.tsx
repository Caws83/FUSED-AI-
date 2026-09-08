import { Badge } from "./Badge.tsx";

export type LaunchCardProps = {
  imageUrl?: string;
  name: string;
  symbol: string;
  creator: string;
  market: string;
  dexVersion: string;
  launchState: string;
  createdAt: string;
};

export function LaunchCard({
  imageUrl,
  name,
  symbol,
  creator,
  market,
  dexVersion,
  launchState,
  createdAt,
}: LaunchCardProps) {
  return (
    <article className="fused-card fused-launch">
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            background: imageUrl
              ? `center / cover url(${imageUrl})`
              : "linear-gradient(135deg, var(--fused-lime), var(--fused-blue))",
          }}
          aria-hidden="true"
        />
        <div>
          <strong>
            {name} <span style={{ color: "var(--fused-muted)" }}>{symbol}</span>
          </strong>
          <div style={{ color: "var(--fused-muted)", fontSize: 13 }}>by {creator}</div>
        </div>
      </div>
      <div className="fused-launch-meta">
        <span>{market}</span>
        <Badge tone="blue">{dexVersion}</Badge>
      </div>
      <div className="fused-launch-meta">
        <span>{launchState}</span>
        <time dateTime={createdAt}>{createdAt}</time>
      </div>
    </article>
  );
}
