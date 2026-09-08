import { Button, Card, EmptyState, SectionHeader } from "@fused-ai/ui";
import { loadRuntime } from "../../lib/runtime.ts";

export const dynamic = "force-dynamic";

export default async function LaunchPage() {
  const { status } = await loadRuntime();
  const deployed = status.launchContracts.status === "OK";
  return (
    <main className="fused-section">
      <div className="fused-wrap" style={{ display: "grid", gap: 22, maxWidth: 720 }}>
        <SectionHeader kicker="Create Launch" title="Create manually" />
        <Card>
          <p style={{ marginTop: 0, color: "var(--fused-muted)" }}>
            Manual launch fields will bind to LaunchFactory.launch once Fused AI contracts are deployed.
            This form does not submit a transaction in Phase 2.
          </p>
          <div style={{ display: "grid", gap: 12 }}>
            <label>
              Name
              <input disabled placeholder="Token name" style={{ display: "block", width: "100%", marginTop: 6, minHeight: 44, borderRadius: 12, border: "1px solid var(--fused-line)", padding: "0 12px" }} />
            </label>
            <label>
              Symbol
              <input disabled placeholder="TICKER" style={{ display: "block", width: "100%", marginTop: 6, minHeight: 44, borderRadius: 12, border: "1px solid var(--fused-line)", padding: "0 12px" }} />
            </label>
            <Button type="button" disabled>
              Fuse
            </Button>
          </div>
        </Card>
        {!deployed ? (
          <EmptyState
            title="Contracts not deployed."
            body="LAUNCH_FACTORY_ADDRESS and LAUNCH_LOCKER_ADDRESS are unset. OpenLaunch live addresses are not used as defaults."
          />
        ) : null}
      </div>
    </main>
  );
}
