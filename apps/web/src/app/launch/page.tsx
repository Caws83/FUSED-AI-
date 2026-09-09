import { SectionHeader, Card } from "@fused-ai/ui";
import { loadEnv, loadRepoEnv } from "@fused-ai/config";
import { ManualLaunch } from "../../components/ManualLaunch.tsx";
import { loadSourcePost } from "../../lib/social.ts";

export const dynamic = "force-dynamic";

export default async function LaunchPage({ searchParams }: { searchParams: Promise<{ post?: string }> }) {
  loadRepoEnv();
  const env = loadEnv();
  const params = await searchParams;
  const sourcePost = await loadSourcePost(params.post);
  const ready = env.publicLaunchEnabled;
  const factory = env.launchFactory && env.launchFactory.startsWith("0x") ? (env.launchFactory as `0x${string}`) : null;
  const locker = env.launchLocker && env.launchLocker.startsWith("0x") ? (env.launchLocker as `0x${string}`) : null;
  return (
    <main className="fused-section">
      <div className="fused-wrap" style={{ display: "grid", gap: 22, maxWidth: 720 }}>
        <SectionHeader kicker="Create Launch" title={sourcePost ? "Fuse this moment" : "Create manually"} />
        {ready && factory ? (
          <ManualLaunch
            factory={factory}
            locker={locker}
            chainId={env.public.chainId}
            chainName={env.public.chainId === 31337 ? "Fused Local" : "Fused AI chain"}
            ready={ready}
            sourcePost={sourcePost}
          />
        ) : (
          <Card>
            <h2 className="fused-h2" style={{ fontSize: 28, marginTop: 0 }}>
              Launching soon
            </h2>
            <p style={{ color: "var(--fused-muted)", marginBottom: 0 }}>
              Public Fused contracts are not live on this deployment. The site is up; create and trade stay off until a
              reviewed public deploy sets them.
            </p>
          </Card>
        )}
      </div>
    </main>
  );
}
