import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SectionHeader } from "@fused-ai/ui";
import { loadEnv, loadPublicEnv, loadRepoEnv, parseSupportedChainId } from "@fused-ai/config";
import { loadLaunchPage, tradeFactoryAddress } from "../../../lib/launches.ts";
import { TokenTerminal } from "../../../components/TokenTerminal.tsx";
import { fetchEthUsd } from "../../../lib/eth-usd.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ address: string }>;
  searchParams: Promise<{ chainId?: string }>;
}): Promise<Metadata> {
  loadRepoEnv();
  const pub = loadPublicEnv();
  const { address } = await params;
  const query = await searchParams;
  const loaded = await loadLaunchPage(address, parseSupportedChainId(query.chainId));
  const launch = loaded?.launch;
  const name = launch?.name?.trim() || launch?.symbol?.trim() || "Token";
  const titled =
    launch?.symbol && launch.name && launch.symbol !== launch.name
      ? `${launch.name} (${launch.symbol})`
      : name;
  const title = `${titled} · FUSED AI`;
  const description =
    launch?.appDescription?.trim() ||
    launch?.sourceExcerpt?.trim() ||
    "Launch a token from a post. One post. One click. One token.";

  return {
    title,
    description,
    metadataBase: pub.appUrl ? new URL(pub.appUrl) : undefined,
    openGraph: {
      title,
      description,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function TokenPage({
  params,
  searchParams,
}: {
  params: Promise<{ address: string }>;
  searchParams: Promise<{ chainId?: string }>;
}) {
  loadRepoEnv();
  const env = loadEnv();
  const { address } = await params;
  const query = await searchParams;
  const loaded = await loadLaunchPage(address, parseSupportedChainId(query.chainId));
  if (!loaded) notFound();
  const factory = env.publicLaunchEnabled ? tradeFactoryAddress(loaded.launch, env) : null;
  const ethUsd = await fetchEthUsd();
  return (
    <main className="fused-section">
      <div className="fused-wrap" style={{ maxWidth: 1180 }}>
        <SectionHeader kicker="Token" title={loaded.launch.name || loaded.launch.symbol || "Token"} />
        <TokenTerminal
          initial={loaded.launch}
          factory={factory}
          chainId={loaded.launch.chainId}
          graduationTargetUsd={env.graduationTargetUsdDisplay}
          indexing={!loaded.indexed}
          ethUsd={ethUsd}
        />
      </div>
    </main>
  );
}
