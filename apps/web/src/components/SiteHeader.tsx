"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { FusedLogo, Navigation } from "@fused-ai/ui";
import { navFor } from "../lib/nav.ts";
import { ConnectWallet } from "./ConnectWallet.tsx";

export function SiteHeader({
  walletConfigured,
  expectedChainId,
}: {
  walletConfigured: boolean;
  expectedChainId: number | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="fused-nav">
      <div className="fused-wrap fused-nav-inner">
        <a className="fused-logo" href="/">
          <FusedLogo variant="horizontal" tone="dark" />
        </a>
        <Navigation items={navFor(pathname)} open={open} />
        <div className="fused-nav-actions">
          <button type="button" className="fused-menu-toggle" onClick={() => setOpen((v) => !v)}>
            Menu
          </button>
          <ConnectWallet configured={walletConfigured} expectedChainId={expectedChainId} />
        </div>
      </div>
    </header>
  );
}
