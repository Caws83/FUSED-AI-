import { SectionHeader } from "@fused-ai/ui";
import { loadEnv, launchContractsAvailability } from "@fused-ai/config";
import { ManualLaunch } from "../../components/ManualLaunch.tsx";

export const dynamic = "force-dynamic";

export default function LaunchPage() {
  const env = loadEnv();
  const ready = launchContractsAvailability(env).status === "OK" && Boolean(env.public.chainId && env.public.rpcUrl);
  const factory = env.launchFactory && env.launchFactory.startsWith("0x") ? (env.launchFactory as `0x${string}`) : null;
  const locker = env.launchLocker && env.launchLocker.startsWith("0x") ? (env.launchLocker as `0x${string}`) : null;
  return (
    <main className="fused-section">
      <div className="fused-wrap" style={{ display: "grid", gap: 22, maxWidth: 720 }}>
        <SectionHeader kicker="Create Launch" title="Create manually" />
        <ManualLaunch
          factory={factory}
          locker={locker}
          chainId={env.public.chainId}
          chainName={env.public.chainId === 31337 ? "Fused Local" : "Fused AI chain"}
          ready={ready}
        />
      </div>
    </main>
  );
}
