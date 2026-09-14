import { notFound } from "next/navigation";
import { LaunchModes } from "../../components/LaunchModes.tsx";
import { StatusBadge } from "@fused-ai/ui";
import { loadRuntime } from "../../lib/runtime.ts";
import { availabilityReason, toDisplayStatus } from "../../lib/status.ts";
import { notConfigured, type Availability } from "@fused-ai/types";
import { isStatusPageEnabled, loadEnv, loadRepoEnv } from "@fused-ai/config";
import { createDatabaseClient } from "@fused-ai/database";

export const dynamic = "force-dynamic";

function sanitizeDetail(value: string): string {
  return value
    .replace(/postgres:\/\/[^@\s]+@/gi, "postgres://***@")
    .replace(/Bearer\s+\S+/gi, "Bearer ***")
    .replace(/sk-[A-Za-z0-9_-]+/g, "sk-***");
}

export default async function StatusPage() {
  loadRepoEnv();
  if (!isStatusPageEnabled()) notFound();
  const { status, dex } = await loadRuntime();
  const env = loadEnv();
  let lastSync: Availability = notConfigured(["SOCIAL_PROVIDER"], "No social sync yet.");
  if (env.databaseUrl) {
    try {
      const db = createDatabaseClient(env);
      const sync = await db.lastSocialSync();
      await db.close();
      if (sync.ok && sync.value.lastSyncAt) {
        lastSync = { status: "OK" };
      }
    } catch {
      lastSync = notConfigured(["DATABASE_URL"], "Database is not reachable.");
    }
  }
  const v4 = dex.find((a) => a.version === "v4");
  const rows = [
    { label: "Social Provider", value: status.social },
    { label: "Tracked Accounts", value: status.trackedAccounts },
    { label: "Last Social Sync", value: lastSync },
    { label: "Media Store", value: status.media },
    { label: "WalletConnect", value: status.walletConnect },
    { label: "Local Chain", value: status.localChain },
    { label: "Indexer", value: status.indexer },
    { label: "Database", value: status.database },
    { label: "Contracts", value: status.launchContracts },
    { label: "RPC", value: status.rpc },
    { label: "Wallet", value: status.wallet },
    { label: "AI Provider", value: status.ai },
    { label: "AI Image", value: status.aiImage },
    {
      label: "V4 Adapter",
      value: v4?.available
        ? status.launchContracts
        : v4?.implemented
          ? status.launchContracts
          : { status: "ADAPTER_NOT_IMPLEMENTED" as const, reason: v4?.reason ?? "not implemented" },
    },
    { label: "Tokenized Asset Registry", value: status.tokenizedAssetRegistry },
    {
      label: "Public launch",
      value: env.publicLaunchEnabled
        ? { status: "OK" as const }
        : { status: "NOT_CONFIGURED" as const, reason: "Launching soon.", missing: ["PUBLIC_LAUNCH_ENABLED"] },
    },
  ];

  return (
    <main className="fused-section">
      <div className="fused-wrap">
        <p className="fused-kicker">Developer</p>
        <h1 className="fused-h2">System status</h1>
        <p style={{ color: "var(--fused-muted)" }}>
          Internal availability only. Public pages never show these strings. Values are names and statuses — never
          secrets.
        </p>
        {status.invalid.length ? (
          <p style={{ color: "var(--fused-danger)" }}>Invalid fields: {status.invalid.join(", ")}</p>
        ) : null}
        <table className="fused-status-table">
          <thead>
            <tr>
              <th>Subsystem</th>
              <th>Status</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const display = toDisplayStatus(row.value.status);
              return (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>
                    <StatusBadge status={display} />
                  </td>
                  <td style={{ color: "var(--fused-muted)", fontSize: 14 }}>
                    {sanitizeDetail(availabilityReason(row.value))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ marginTop: 28 }}>
          <p className="fused-kicker">Configured contracts</p>
          <table className="fused-status-table">
            <thead>
              <tr>
                <th>Contract</th>
                <th>Address</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Fused Factory V2 (default)", value: env.launch.v2?.factory ?? env.launchFactory },
                { label: "Fused Locker V2", value: env.launch.v2?.locker ?? env.launchLocker },
                { label: "Fused Factory V1 (legacy)", value: env.launch.v1?.factory },
                { label: "Fused Locker V1", value: env.launch.v1?.locker },
                { label: "PoolManager", value: env.uniswap.poolManager },
                { label: "PositionManager", value: env.uniswap.positionManager },
                { label: "Permit2", value: env.uniswap.permit2 },
              ].map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td style={{ wordBreak: "break-all", fontSize: 14, color: "var(--fused-muted)" }}>
                    {row.value || "unset"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ color: "var(--fused-muted)", fontSize: 14 }}>
            New launches call FusedFactoryV2.create at the V2 factory. Legacy V1 tokens still trade on V1.
            OpenLaunch LaunchFactory.launch is not the create path. Local Anvil addresses are rejected on public chains.
          </p>
        </div>
        <div style={{ marginTop: 28 }}>
          <p className="fused-kicker">DEX adapters</p>
          <LaunchModes adapters={dex} />
        </div>
      </div>
    </main>
  );
}
