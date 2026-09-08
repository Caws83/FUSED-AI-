import type { DexAdapterInfo } from "@fused-ai/types";
import { Badge, Card, StatusBadge } from "@fused-ai/ui";

function v4Labels(info: DexAdapterInfo): { status: "READY" | "NOT_DEPLOYED" | "PLANNED"; detail: string } {
  if (info.available) return { status: "READY", detail: "Deployed" };
  if (info.implemented) return { status: "NOT_DEPLOYED", detail: "Implemented" };
  return { status: "PLANNED", detail: "Planned" };
}

export function LaunchModes({ adapters }: { adapters: readonly DexAdapterInfo[] }) {
  return (
    <div className="fused-grid-3">
      {adapters.map((info) => {
        const labels =
          info.version === "v4"
            ? v4Labels(info)
            : { status: "PLANNED" as const, detail: "Planned" };
        return (
          <Card key={info.version}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <strong style={{ fontFamily: "var(--fused-display)", fontSize: 28, letterSpacing: "-0.04em" }}>
                {info.version.toUpperCase()}
              </strong>
              <Badge tone={info.version === "v4" ? "lime" : "muted"}>Uniswap</Badge>
            </div>
            <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
              <StatusBadge status={labels.status} label={labels.detail} />
              {info.version === "v4" && !info.available ? (
                <StatusBadge status="NOT_DEPLOYED" label="Not deployed" />
              ) : null}
              <p style={{ margin: 0, color: "var(--fused-muted)", fontSize: 14 }}>
                {info.reason ?? (info.available ? "Factory and locker addresses are set." : "")}
              </p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
