"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Navigation } from "@fused-ai/ui";
import { navFor } from "../lib/nav.ts";
import { ConnectWallet } from "./ConnectWallet.tsx";

export function SiteHeader({ walletConfigured }: { walletConfigured: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="fused-nav">
      <div className="fused-wrap fused-nav-inner">
        <a className="fused-logo" href="/">
          <span className="fused-mark" aria-hidden="true" />
          FUSED AI
        </a>
        <Navigation items={navFor(pathname)} open={open} />
        <div className="fused-nav-actions">
          <button type="button" className="fused-menu-toggle" onClick={() => setOpen((v) => !v)}>
            Menu
          </button>
          <ConnectWallet configured={walletConfigured} />
        </div>
      </div>
    </header>
  );
}
