import type { ReactNode } from "react";

type Tone = "lime" | "blue" | "navy" | "muted";

export function Badge({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return <span className={`fused-badge fused-badge-${tone}`}>{children}</span>;
}
