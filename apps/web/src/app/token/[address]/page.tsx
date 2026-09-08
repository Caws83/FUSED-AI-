import { notFound } from "next/navigation";
import { Card, SectionHeader } from "@fused-ai/ui";
import { loadIndexedLaunch } from "../../../lib/launches.ts";

export const dynamic = "force-dynamic";

export default async function TokenPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const launch = await loadIndexedLaunch(address);
  if (!launch) notFound();
  const rows = [
    ["Token name", launch.name || "—"],
    ["Ticker", launch.symbol || "—"],
    ["Contract", launch.token],
    ["Creator", launch.launcher],
    ["Launch transaction", launch.txHash],
    ["Launch block", launch.blockNumber.toString()],
    ["DEX version", launch.dexVersion.toUpperCase()],
    ["Factory", launch.factory ?? "—"],
    ["Locker", launch.locker ?? "—"],
    ["Chain", String(launch.chainId)],
    ["Quote", launch.quote === "0x0000000000000000000000000000000000000000" ? "ETH" : launch.quote],
  ] as const;
  return (
    <main className="fused-section">
      <div className="fused-wrap" style={{ display: "grid", gap: 22, maxWidth: 800 }}>
        <SectionHeader kicker="Token" title={launch.name || launch.token} />
        <Card>
          <dl className="fused-review">
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd style={{ wordBreak: "break-all" }}>{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </main>
  );
}
