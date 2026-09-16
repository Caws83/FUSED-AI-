export function chainBadgeLabel(chainId: number): string {
  if (chainId === 5042) return "Arc";
  if (chainId === 5042002) return "Arc Testnet";
  if (chainId === 4663) return "Robinhood";
  if (chainId === 46630) return "Robinhood Testnet";
  return `Chain ${chainId}`;
}

function chainKind(chainId: number): "arc" | "robinhood" | "unknown" {
  if (chainId === 5042 || chainId === 5042002) return "arc";
  if (chainId === 4663 || chainId === 46630) return "robinhood";
  return "unknown";
}

function ArcMark() {
  return (
    <svg className="fused-chain-mark" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="8" fill="#0a1628" />
      <path
        d="M3.6 10.4a5.1 5.1 0 0 1 8.8 0"
        fill="none"
        stroke="#7dd3fc"
        strokeWidth="1.85"
        strokeLinecap="round"
      />
      <circle cx="8" cy="6.1" r="1.45" fill="#c8f54a" />
    </svg>
  );
}

function RobinhoodMark() {
  return (
    <svg className="fused-chain-mark" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="8" fill="#00C805" />
      <path
        d="M8 3.15c1.55 0 2.55 1.28 2.55 3.05v3.7c0 .95-.92 1.65-2.55 1.65s-2.55-.7-2.55-1.65V6.2c0-1.77 1-3.05 2.55-3.05z"
        fill="#fff"
      />
    </svg>
  );
}

function UnknownMark() {
  return (
    <svg className="fused-chain-mark" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="8" fill="#c9d5e3" />
    </svg>
  );
}

export function ChainBadge({ chainId }: { chainId: number }) {
  const kind = chainKind(chainId);
  const label = chainBadgeLabel(chainId);
  return (
    <span className={`fused-chain-badge fused-chain-badge-${kind}`} title={label}>
      {kind === "arc" ? <ArcMark /> : kind === "robinhood" ? <RobinhoodMark /> : <UnknownMark />}
      {label}
    </span>
  );
}
