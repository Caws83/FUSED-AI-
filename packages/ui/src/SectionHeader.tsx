import type { ReactNode } from "react";

export function SectionHeader({
  kicker,
  title,
  action,
}: {
  kicker?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="fused-section-header">
      <div>
        {kicker ? <p className="fused-kicker">{kicker}</p> : null}
        <h2 className="fused-h2">{title}</h2>
      </div>
      {action}
    </div>
  );
}
