import { loadEnv, systemStatus } from "@fused-ai/config";
import { listDexAdapters } from "@fused-ai/blockchain";

export const dynamic = "force-dynamic";

function Row({ label, status, reason }: { label: string; status: string; reason?: string }) {
  const ok = status === "OK";
  return (
    <tr>
      <td style={{ padding: "8px 12px", borderBottom: "1px solid #1e2a36" }}>{label}</td>
      <td style={{ padding: "8px 12px", borderBottom: "1px solid #1e2a36", color: ok ? "#4ade80" : "#fbbf24" }}>
        {status}
      </td>
      <td style={{ padding: "8px 12px", borderBottom: "1px solid #1e2a36", color: "#93a4b5", fontSize: 14 }}>
        {reason ?? (ok ? "configured" : "")}
      </td>
    </tr>
  );
}

export default function HomePage() {
  const env = loadEnv();
  const status = systemStatus(env);
  const dex = listDexAdapters(env);

  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "48px 20px" }}>
      <p style={{ letterSpacing: "0.16em", fontSize: 12, color: "#7dd3fc" }}>FUSED AI · PHASE 1</p>
      <h1 style={{ fontSize: 36, margin: "8px 0 0" }}>Launch a token with just 1 click from a tweet.</h1>
      <p style={{ color: "#93a4b5", lineHeight: 1.5 }}>
        This surface reports real subsystem availability. It does not list tokens, prices, trending posts, or
        AI drafts. Those appear only when the corresponding provider is configured and implemented.
      </p>
      <h2 style={{ marginTop: 36 }}>Subsystem status</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <Row label="Database" status={status.database.status} reason={"reason" in status.database ? status.database.reason : undefined} />
          <Row label="RPC" status={status.rpc.status} reason={"reason" in status.rpc ? status.rpc.reason : undefined} />
          <Row label="Social ingestion" status={status.social.status} reason={"reason" in status.social ? status.social.reason : undefined} />
          <Row label="AI generation" status={status.ai.status} reason={"reason" in status.ai ? status.ai.reason : undefined} />
          <Row
            label="Launch contracts"
            status={status.launchContracts.status}
            reason={"reason" in status.launchContracts ? status.launchContracts.reason : undefined}
          />
          {dex.map((adapter) => {
            const info = adapter.info();
            return (
              <Row
                key={info.version}
                label={`DEX Uniswap ${info.version.toUpperCase()}`}
                status={info.available ? "OK" : info.implemented ? "CONTRACTS_NOT_DEPLOYED" : "ADAPTER_NOT_IMPLEMENTED"}
                reason={info.reason ?? undefined}
              />
            );
          })}
        </tbody>
      </table>
      <p style={{ marginTop: 32, color: "#64748b", fontSize: 14 }}>
        Private keys never live in this process. Users sign launches in their wallet. See docs/ARCHITECTURE.md.
      </p>
    </main>
  );
}
