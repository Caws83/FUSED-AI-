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
  const chainId = wallet?.chainId ?? null;
  const rpcUrl = wallet?.rpcUrl ?? null;
  const walletConnectProjectId = wallet?.walletConnectProjectId ?? null;

  const config = useMemo(() => {
    if (chainId == null || !rpcUrl) return null;
    const chain =
      chainId === 31337
        ? {
            ...anvil,
            name: "Fused Local",
            rpcUrls: { default: { http: [rpcUrl] }, public: { http: [rpcUrl] } },
          }
        : defineChain({
            id: chainId,
            name: "Fused AI chain",
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: { default: { http: [rpcUrl] } },
          });
    const kinds = walletConnectorKinds(walletConnectProjectId);
    const connectors = [
      injected(),
      ...(kinds.includes("walletConnect") && walletConnectProjectId
        ? [walletConnect({ projectId: walletConnectProjectId, showQrModal: true })]
        : []),
    ];
    return createConfig({
      chains: [chain],
      connectors,
      transports: { [chain.id]: http(rpcUrl) },
      ssr: true,
    });
  }, [chainId, rpcUrl, walletConnectProjectId]);

  if (!config) return children;
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
