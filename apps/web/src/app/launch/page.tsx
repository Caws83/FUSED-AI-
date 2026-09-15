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
  return (
    <main className="fused-section">
      <div className="fused-wrap" style={{ display: "grid", gap: 22, maxWidth: 720 }}>
        <SectionHeader kicker="Create Launch" title={sourcePost ? "Fuse this moment" : "Create manually"} />
        {ready ? (
          <ManualLaunch ready sourcePost={sourcePost} />
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
