import { Button, Card, SectionHeader } from "@fused-ai/ui";

export const dynamic = "force-dynamic";

export default function LaunchPage() {
  return (
    <main className="fused-section">
      <div className="fused-wrap" style={{ display: "grid", gap: 22, maxWidth: 720 }}>
        <SectionHeader kicker="Create Launch" title="Create manually" />
        <Card>
          <p style={{ marginTop: 0, color: "var(--fused-muted)" }}>
            Set the name and ticker. You review everything before your wallet signs.
          </p>
          <div style={{ display: "grid", gap: 12 }}>
            <label>
              Name
              <input
                placeholder="Token name"
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: 6,
                  minHeight: 44,
                  borderRadius: 12,
                  border: "1px solid var(--fused-line)",
                  padding: "0 12px",
                }}
              />
            </label>
            <label>
              Symbol
              <input
                placeholder="TICKER"
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: 6,
                  minHeight: 44,
                  borderRadius: 12,
                  border: "1px solid var(--fused-line)",
                  padding: "0 12px",
                }}
              />
            </label>
            <Button type="button" disabled>
              Fuse
            </Button>
            <p style={{ margin: 0, color: "var(--fused-muted)", fontSize: 14 }}>Manual launch is coming soon.</p>
          </div>
        </Card>
      </div>
    </main>
  );
}
