import { LaunchModes } from "../../components/LaunchModes.tsx";
import { StatusBadge } from "@fused-ai/ui";
import { loadRuntime } from "../../lib/runtime.ts";
import { availabilityReason, toDisplayStatus } from "../../lib/status.ts";
import { loadEnv, loadRepoEnv } from "@fused-ai/config";
import { createDatabaseClient } from "@fused-ai/database";

export const dynamic = "force-dynamic";

export default async function StatusPage() {
  loadRepoEnv();
  const { status, dex } = await loadRuntime();
  const env = loadEnv();
  const db = createDatabaseClient(env);
  if (env.databaseUrl) await db.migrate();
  const sync = env.databaseUrl ? await db.lastSocialSync() : null;
  await db.close();
  const v4 = dex.find((a) => a.version === "v4");
  const lastSync =
    sync && sync.ok && sync.value.lastSyncAt
      ? { status: "OK" as const, reason: `${sync.value.lastSyncAt} (${sync.value.postCount} posts)` }
      : { status: "NOT_CONFIGURED" as const, reason: "No social sync yet.", missing: ["SOCIAL_PROVIDER"] };
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
  ];

  return (
    <main className="fused-section">
      <div className="fused-wrap">
        <p className="fused-kicker">Developer</p>
        <h1 className="fused-h2">System status</h1>
        <p style={{ color: "var(--fused-muted)" }}>
          Internal availability only. Public pages never show these strings.
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
                  <td style={{ color: "var(--fused-muted)", fontSize: 14 }}>{availabilityReason(row.value)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ marginTop: 28 }}>
          <p className="fused-kicker">DEX adapters</p>
          <LaunchModes adapters={dex} />
        </div>
      </div>
    </main>
  );
}
