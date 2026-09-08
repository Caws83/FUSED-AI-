"use client";

import { type ReactNode, useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { anvil } from "viem/chains";
import { defineChain } from "viem";
import { walletConnectorKinds } from "../lib/wallet.ts";

export type WalletRuntimeConfig = {
  chainId: number;
  rpcUrl: string;
  walletConnectProjectId: string | null;
};

const queryClient = new QueryClient();

export function Providers({
  wallet,
  children,
}: {
  wallet: WalletRuntimeConfig | null;
  children: ReactNode;
}) {
  const config = useMemo(() => {
    if (!wallet) return null;
    const chain =
      wallet.chainId === 31337
        ? {
            ...anvil,
            name: "Fused Local",
            rpcUrls: { default: { http: [wallet.rpcUrl] }, public: { http: [wallet.rpcUrl] } },
          }
        : defineChain({
            id: wallet.chainId,
            name: "Fused AI chain",
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: { default: { http: [wallet.rpcUrl] } },
          });
    const kinds = walletConnectorKinds(wallet.walletConnectProjectId);
    const connectors = [
      injected(),
      ...(kinds.includes("walletConnect") && wallet.walletConnectProjectId
        ? [walletConnect({ projectId: wallet.walletConnectProjectId, showQrModal: true })]
        : []),
    ];
    return createConfig({
      chains: [chain],
      connectors,
      transports: { [chain.id]: http(wallet.rpcUrl) },
      ssr: true,
    });
  }, [wallet]);

  if (!config) return children;
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
