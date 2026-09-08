export type DisplayStatus = "READY" | "NOT_CONFIGURED" | "UNAVAILABLE" | "NOT_DEPLOYED" | "PLANNED";

export function StatusBadge({ status, label }: { status: DisplayStatus; label?: string }) {
  return (
    <span className={`fused-status fused-status-${status}`}>
      <span className="fused-status-dot" aria-hidden="true" />
      {label ?? status}
    </span>
  );
}
