"use client";

import { type ReactNode, useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, createStorage, http, noopStorage } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { anvil } from "viem/chains";
import { defineChain, type Chain } from "viem";
import {
  ARC_TESTNET,
  ARC_TESTNET_CHAIN_ID,
  ROBINHOOD_TESTNET,
  ROBINHOOD_TESTNET_CHAIN_ID,
} from "@fused-ai/config/public";
import { chainLabelFor, nativeCurrencyFor, walletConnectorKinds } from "../lib/wallet.ts";

export type WalletRuntimeConfig = {
  chainId: number;
  rpcUrl: string;
  walletConnectProjectId: string | null;
};

const queryClient = new QueryClient();

function fusedChain(chainId: number, rpcUrl: string): Chain {
  return defineChain({
    id: chainId,
    name: chainLabelFor(chainId) ?? "Fused AI chain",
    nativeCurrency: nativeCurrencyFor(chainId),
    rpcUrls: { default: { http: [rpcUrl] } },
  });
}

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
    const robinhoodRpc = chainId === ROBINHOOD_TESTNET_CHAIN_ID ? rpcUrl : ROBINHOOD_TESTNET.rpcUrl;
    const arcRpc = chainId === ARC_TESTNET_CHAIN_ID ? rpcUrl : ARC_TESTNET.rpcUrl;
    const robinhood = fusedChain(ROBINHOOD_TESTNET_CHAIN_ID, robinhoodRpc);
    const arc = fusedChain(ARC_TESTNET_CHAIN_ID, arcRpc);
    const chains: [Chain, ...Chain[]] =
      chainId === 31337
        ? [
            {
              ...anvil,
              name: chainLabelFor(31337) ?? "Fused Local",
              rpcUrls: { default: { http: [rpcUrl] }, public: { http: [rpcUrl] } },
            },
            robinhood,
            arc,
          ]
        : [robinhood, arc];
    const kinds = walletConnectorKinds(walletConnectProjectId);
    const connectors = [
      injected(),
      ...(kinds.includes("walletConnect") && walletConnectProjectId
        ? [walletConnect({ projectId: walletConnectProjectId, showQrModal: true })]
        : []),
    ];
    const transports: Record<number, ReturnType<typeof http>> = {
      [ROBINHOOD_TESTNET_CHAIN_ID]: http(robinhoodRpc),
      [ARC_TESTNET_CHAIN_ID]: http(arcRpc),
    };
    if (chainId === 31337) transports[31337] = http(rpcUrl);
    return createConfig({
      chains,
      connectors,
      transports,
      ssr: true,
      storage: createStorage({
        storage: typeof window !== "undefined" && window.localStorage ? window.localStorage : noopStorage,
      }),
    });
  }, [chainId, rpcUrl, walletConnectProjectId]);

  if (!config) return children;
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
