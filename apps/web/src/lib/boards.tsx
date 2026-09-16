import { LaunchCard } from "@fused-ai/ui";
import { tokenImageSrc } from "@fused-ai/media/token-image";
import type { IndexedLaunch } from "@fused-ai/types";
import { fdvWei, marketCapWei } from "@fused-ai/blockchain/fused";
import { formatAge, formatHeadlineUsd, formatNative, progressFromLaunch, shortAddr, stateBadge } from "./format.ts";
import { nativeCurrencyFor } from "./wallet.ts";

export function launchCardProps(launch: IndexedLaunch, ethUsd: number | null = null) {
  const state = stateBadge(launch.lifecycleState, launch.dexVersion);
  const price = BigInt(launch.priceX18 ?? "0");
  const circ = BigInt(launch.circulating ?? "0");
  const mc = price > 0n && circ > 0n ? marketCapWei(price, circ) : 0n;
  return {
    imageUrl: tokenImageSrc(launch.imageUrl, launch.chainId),
    name: launch.name || "Token",
    symbol: launch.symbol || "—",
    creator: shortAddr(launch.launcher),
    token: launch.token,
    txHash: launch.txHash,
    dexVersion: launch.dexVersion.toUpperCase(),
    launchState: state,
    createdAt: formatAge(launch.createdAt, launch.blockNumber),
    progressPct: progressFromLaunch(launch),
    marketCap: formatHeadlineUsd(mc, launch.chainId, ethUsd),
    volume: formatNative(launch.volumeQuote, nativeCurrencyFor(launch.chainId).symbol),
    state,
    chainId: launch.chainId,
  };
}

export function LaunchGrid({
  launches,
  ethUsd = null,
}: {
  launches: IndexedLaunch[];
  ethUsd?: number | null;
}) {
  return (
    <div className="fused-grid-3">
      {launches.map((launch) => (
        <a key={`${launch.chainId}:${launch.token}`} href={`/token/${launch.token}?chainId=${launch.chainId}`} style={{ color: "inherit" }}>
          <LaunchCard {...launchCardProps(launch, ethUsd)} />
        </a>
      ))}
    </div>
  );
}

export function splitBoards(launches: IndexedLaunch[]) {
  const curve = launches.filter((l) => stateBadge(l.lifecycleState, l.dexVersion) === "CURVE");
  const graduated = launches.filter((l) => stateBadge(l.lifecycleState, l.dexVersion) === "GRADUATED");
  const graduating = curve.filter((l) => progressFromLaunch(l) >= 8000);
  return {
    live: curve,
    newly: [...launches].slice(0, 6),
    graduating,
    graduated,
  };
}

export function fdvLabel(launch: IndexedLaunch, ethUsd: number | null = null): string {
  const price = BigInt(launch.priceX18 ?? "0");
  const supply = BigInt(launch.supply ?? "0");
  if (price === 0n || supply === 0n) return "—";
  return formatHeadlineUsd(fdvWei(price, supply), launch.chainId, ethUsd);
}
