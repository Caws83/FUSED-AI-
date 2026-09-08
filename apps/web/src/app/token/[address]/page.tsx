import { notFound } from "next/navigation";
import { Card, SectionHeader } from "@fused-ai/ui";
import { loadIndexedLaunch } from "../../../lib/launches.ts";

export const dynamic = "force-dynamic";

export default async function TokenPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const launch = await loadIndexedLaunch(address);
  if (!launch) notFound();
  const image = launch.imageUrl || "/brand/fused-token.svg";
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
          <img src={image} alt="" width={96} height={96} style={{ borderRadius: 20, objectFit: "cover" }} />
          <dl className="fused-review">
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd style={{ wordBreak: "break-all" }}>{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
        {launch.sourcePostUrl ? (
          <Card>
            <p className="fused-kicker">Origin</p>
            <p style={{ marginTop: 0 }}>
              This launch was fused from a public post. The token creator is the wallet that signed — not
              necessarily the original author.
            </p>
            {launch.sourceAuthor ? <strong>@{launch.sourceAuthor}</strong> : null}
            {launch.sourceExcerpt ? <p style={{ whiteSpace: "pre-wrap" }}>{launch.sourceExcerpt}</p> : null}
            <a href={launch.sourcePostUrl} target="_blank" rel="noreferrer">
              View original post
            </a>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
