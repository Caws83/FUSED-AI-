"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Navigation } from "@fused-ai/ui";

import {
  AppKitButton,
  AppKitNetworkButton,
} from "@reown/appkit/react";

import { navFor } from "../lib/nav.ts";

export function SiteHeader({
  walletConfigured,
}: {
  walletConfigured: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
            <span className="fused-brand-fused">
              FUSED
            </span>

            <span className="fused-brand-ai">
              AI
            </span>
          </span>
        </a>

        <Navigation
          items={navFor(pathname)}
          open={open}
        >
          {walletConfigured ? (
            <div className="fused-nav-mobile-tools">
              <AppKitNetworkButton />
              <AppKitButton balance="hide" />
            </div>
          ) : null}
        </Navigation>

        <div className="fused-nav-actions">
          {walletConfigured ? (
            <>
              <div className="fused-nav-desktop-tools">
                <AppKitNetworkButton />
              </div>

              <AppKitButton balance="hide" />
            </>
          ) : null}

          <button
            type="button"
            className="fused-menu-toggle"
            aria-label={
              open ? "Close menu" : "Open menu"
            }
            aria-expanded={open}
            aria-controls="fused-primary-nav"
            onClick={() => setOpen((v) => !v)}
          >
            <span
              className="fused-menu-icon"
              data-open={open ? "true" : "false"}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
    </header>
  );
}