"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Navigation } from "@fused-ai/ui";
import { navFor } from "../lib/nav.ts";
import { ConnectWallet } from "./ConnectWallet.tsx";
import { DEFAULT_PREFERRED_CHAIN_ID, NetworkSelector } from "./NetworkSelector.tsx";

export function SiteHeader({ walletConfigured }: { walletConfigured: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [preferredChainId, setPreferredChainId] = useState(DEFAULT_PREFERRED_CHAIN_ID);
  return (
    <header className="fused-nav">
      <div className="fused-wrap fused-nav-inner">
        <a className="fused-logo" href="/">
          <img
            src="/brand/fused-ai-logo.png"
            alt=""
            aria-hidden="true"
            className="fused-logo-image"
            width={1520}
            height={998}
          />
          <span className="fused-brand-word">
            <span className="fused-brand-fused">FUSED</span>
            <span className="fused-brand-ai">AI</span>
          </span>
        </a>
        <Navigation items={navFor(pathname)} open={open} />
        <div className="fused-nav-actions">
          <button type="button" className="fused-menu-toggle" onClick={() => setOpen((v) => !v)}>
            Menu
          </button>
          {walletConfigured ? (
            <NetworkSelector preferredChainId={preferredChainId} onPreferredChainId={setPreferredChainId} />
          ) : null}
          <ConnectWallet configured={walletConfigured} preferredChainId={preferredChainId} />
        </div>
      </div>
    </header>
  );
}
