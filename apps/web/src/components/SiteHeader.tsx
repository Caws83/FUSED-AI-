"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Navigation } from "@fused-ai/ui";
import { useAppKit, useAppKitAccount, useAppKitState } from "@reown/appkit/react";
import {
  ARC_MAINNET_CHAIN_ID,
  ROBINHOOD_MAINNET_CHAIN_ID,
  WALLET_SELECTOR_CHAIN_IDS,
  chainLabelFor,
} from "@fused-ai/config/public";
import { navFor } from "../lib/nav.ts";

function networkLabelFor(selectedNetworkId: string | undefined): string {
  const match = selectedNetworkId?.match(/^eip155:(\d+)$/);
  const chainId = match ? Number(match[1]) : null;
  if (chainId && (WALLET_SELECTOR_CHAIN_IDS as readonly number[]).includes(chainId)) {
    return chainLabelFor(chainId) ?? `Chain ${chainId}`;
  }
  if (chainId === ROBINHOOD_MAINNET_CHAIN_ID) return "Robinhood Mainnet";
  if (chainId === ARC_MAINNET_CHAIN_ID) return "Arc Mainnet";
  return "Select Network";
}

export function SiteHeader({ walletConfigured }: { walletConfigured: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [walletUiReady, setWalletUiReady] = useState(false);
  const { open: openModal, close: closeModal } = useAppKit();
  const { isConnected, address } = useAppKitAccount();
  const { selectedNetworkId, open: modalOpen } = useAppKitState();
  const previousNetworkId = useRef<string | undefined>(undefined);

  useEffect(() => {
    setWalletUiReady(true);
  }, []);

  useEffect(() => {
    setOpen(false);
    void closeModal();
  }, [pathname]);

  useEffect(() => {
    if (!walletUiReady) return;
    const previous = previousNetworkId.current;
    if (previous === undefined) {
      previousNetworkId.current = selectedNetworkId;
      return;
    }
    previousNetworkId.current = selectedNetworkId;
    if (!modalOpen || !selectedNetworkId || previous === selectedNetworkId) return;
    void closeModal();
  }, [walletUiReady, selectedNetworkId, modalOpen, closeModal]);

  const truncatedAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";
  const networkLabel = walletUiReady ? networkLabelFor(selectedNetworkId) : "Select Network";
  const walletLabel = walletUiReady && isConnected && truncatedAddress ? truncatedAddress : "Connect Wallet";

  function openNetworkModal() {
    setOpen(false);
    void openModal({ view: "Networks" });
  }

  function openWalletModal() {
    setOpen(false);
    void openModal({ view: isConnected ? "Account" : "Connect" });
  }

  return (
    <header className="fused-nav">
      <div className="fused-wrap fused-nav-inner">
        <a className="fused-logo" href="/">
          <img
            src="/brand/fused-ai-logo.png"
            alt=""
            aria-hidden="true"
            className="fused-logo-image fused-logo-image-light"
            width={1520}
            height={998}
          />
          <img
            src="/brand/fused-ai-logo-white.png"
            alt=""
            aria-hidden="true"
            className="fused-logo-image fused-logo-image-dark"
            width={1520}
            height={998}
          />
          <span className="fused-brand-word">
            <span className="fused-brand-fused">FUSED</span>
            <span className="fused-brand-ai">AI</span>
          </span>
        </a>
        <Navigation items={navFor(pathname)} open={open}>
          {walletConfigured ? (
            <div className="fused-nav-mobile-tools">
              <button type="button" className="fused-btn-network" onClick={openNetworkModal}>
                <span className="fused-btn-network-dot" aria-hidden="true" />
                {networkLabel}
              </button>
              <button type="button" className="fused-btn-connect" onClick={openWalletModal}>
                {walletLabel}
              </button>
            </div>
          ) : null}
        </Navigation>
        <div className="fused-nav-actions">
          {walletConfigured ? (
            <div className="fused-nav-desktop-tools">
              <button type="button" className="fused-btn-network" onClick={openNetworkModal}>
                <span className="fused-btn-network-dot" aria-hidden="true" />
                {networkLabel}
              </button>
              <button type="button" className="fused-btn-connect" onClick={openWalletModal}>
                {walletLabel}
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
            <span className="fused-menu-icon" data-open={open ? "true" : "false"} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
