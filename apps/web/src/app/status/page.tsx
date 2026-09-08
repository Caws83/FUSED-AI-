import { StatusBadge } from "@fused-ai/ui";
import { loadRuntime } from "../../lib/runtime.ts";
import { availabilityReason, toDisplayStatus } from "../../lib/status.ts";

export const dynamic = "force-dynamic";

export default async function StatusPage() {
  const { status, dex } = await loadRuntime();
  const v4 = dex.find((a) => a.version === "v4");
  const rows = [
    { label: "Database", value: status.database },
    { label: "RPC", value: status.rpc },
    { label: "Social Provider", value: status.social },
    { label: "AI Provider", value: status.ai },
    { label: "Indexer", value: status.indexer },
    { label: "Contracts", value: status.launchContracts },
    {
      label: "V4 Adapter",
      value: v4?.available
        ? status.launchContracts
        : v4?.implemented
          ? status.launchContracts
          : { status: "ADAPTER_NOT_IMPLEMENTED" as const, reason: v4?.reason ?? "not implemented" },
    },
    { label: "Tokenized Asset Registry", value: status.tokenizedAssetRegistry },
    { label: "Wallet", value: status.wallet },
  ];

  return (
    <main className="fused-section">
      <div className="fused-wrap">
        <p className="fused-kicker">Developer</p>
        <h1 className="fused-h2">System status</h1>
        <p style={{ color: "var(--fused-muted)" }}>
          Honest availability. Empty configuration is shown as empty, not mocked.
        </p>
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
            {dex.map((info) => (
              <tr key={`dex-${info.version}`}>
                <td>DEX Uniswap {info.version.toUpperCase()}</td>
                <td>
                  <StatusBadge
                    status={
                      info.available ? "READY" : info.implemented ? "NOT_DEPLOYED" : "PLANNED"
                    }
                  />
                </td>
                <td style={{ color: "var(--fused-muted)", fontSize: 14 }}>{info.reason ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
