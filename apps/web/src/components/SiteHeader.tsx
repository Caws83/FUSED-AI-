"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Navigation } from "@fused-ai/ui";

import {
  useAppKit,
  useAppKitAccount,
  useAppKitState,
} from "@reown/appkit/react";

import {
  ARC_TESTNET_CHAIN_ID,
  ROBINHOOD_TESTNET_CHAIN_ID,
} from "@fused-ai/config/public";

import { navFor } from "../lib/nav.ts";

export function SiteHeader({
  walletConfigured,
}: {
  walletConfigured: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const { open: openModal } = useAppKit();
  const { isConnected, address } = useAppKitAccount();
  const { selectedNetworkId } = useAppKitState();

  const truncatedAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "";

  const networkLabel =
    selectedNetworkId === `eip155:${ROBINHOOD_TESTNET_CHAIN_ID}`
      ? "Robinhood Testnet"
      : selectedNetworkId === `eip155:${ARC_TESTNET_CHAIN_ID}`
        ? "Arc Testnet"
        : "Select Network";

  const openNetworkModal = () => {
    openModal({ view: "Networks" });
  };

  const openWalletModal = () => {
    openModal({
      view: isConnected ? "Account" : "Connect",
    });
  };

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

        <Navigation
          items={navFor(pathname)}
          open={open}
        >
          {walletConfigured ? (
            <div className="fused-nav-mobile-tools">
              <button
                type="button"
                className="fused-btn-network"
                onClick={openNetworkModal}
              >
                <span
                  className="fused-btn-network-dot"
                  aria-hidden="true"
                />
                {networkLabel}
              </button>

              <button
                type="button"
                className="fused-btn-connect"
                onClick={openWalletModal}
              >
                {isConnected
                  ? truncatedAddress
                  : "Connect Wallet"}
              </button>
            </div>
          ) : null}
        </Navigation>

        <div className="fused-nav-actions">
          {walletConfigured ? (
            <div className="fused-nav-desktop-tools">
              <button
                type="button"
                className="fused-btn-network"
                onClick={openNetworkModal}
              >
                <span
                  className="fused-btn-network-dot"
                  aria-hidden="true"
                />
                {networkLabel}
              </button>

              <button
                type="button"
                className="fused-btn-connect"
                onClick={openWalletModal}
              >
                {isConnected
                  ? truncatedAddress
                  : "Connect Wallet"}
              </button>
            </div>
          ) : null}

          <button
            type="button"
            className="fused-menu-toggle"
            aria-label={open ? "Close menu" : "Open menu"}
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