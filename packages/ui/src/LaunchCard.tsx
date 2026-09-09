import { Badge } from "./Badge.tsx";

export type LaunchCardProps = {
  imageUrl?: string;
  name: string;
  symbol: string;
  creator: string;
  token?: string;
  txHash?: string;
  market?: string;
  dexVersion: string;
  launchState: string;
  createdAt: string;
  progressPct?: number | null;
  marketCap?: string | null;
  volume?: string | null;
  state?: string | null;
};

export function LaunchCard({
  imageUrl,
  name,
  symbol,
  creator,
  token,
  txHash,
  market,
  dexVersion,
  launchState,
  createdAt,
  progressPct,
  marketCap,
  volume,
  state,
}: LaunchCardProps) {
  const badge = (state ?? "").toUpperCase() === "GRADUATED" || dexVersion === "uniswap_v4" || dexVersion === "v4"
    ? "GRADUATED"
    : "CURVE";
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
        <Badge tone={badge === "GRADUATED" ? "blue" : "lime"}>{badge}</Badge>
      </div>
      {token ? (
        <div style={{ color: "var(--fused-muted)", fontSize: 13, wordBreak: "break-all" }}>{token}</div>
      ) : null}
      {progressPct != null ? (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--fused-muted)" }}>
            <span>Bonding</span>
            <span>{(progressPct / 100).toFixed(1)}%</span>
          </div>
          <div className="fused-progress">
            <i style={{ width: `${Math.min(100, progressPct / 100)}%` }} />
          </div>
        </div>
      ) : null}
      <div className="fused-launch-meta">
        {marketCap ? <span>MC {marketCap}</span> : market ? <span>{market}</span> : <span>{launchState}</span>}
        {volume ? <span>Vol {volume}</span> : null}
      </div>
      <div className="fused-launch-meta">
        <time dateTime={createdAt}>{createdAt}</time>
        {txHash ? (
          <span style={{ wordBreak: "break-all" }}>
            {txHash.slice(0, 10)}…{txHash.slice(-6)}
          </span>
        ) : null}
      </div>
    </article>
  );
}
