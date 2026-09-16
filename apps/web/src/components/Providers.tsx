"use client";

import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, type Config } from "wagmi";

import {
  defineChain,
  type AppKitNetwork,
} from "@reown/appkit/networks";

import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";

import {
  ARC_TESTNET,
  ARC_TESTNET_CHAIN_ID,
  ROBINHOOD_TESTNET,
  ROBINHOOD_TESTNET_CHAIN_ID,
} from "@fused-ai/config/public";

import {
  chainLabelFor,
  nativeCurrencyFor,
} from "../lib/wallet.ts";

const queryClient = new QueryClient();

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
  "2b6111ec844e3cd755c1792dfacc8533";

function fusedChain(
  chainId: number,
  rpcUrl: string,
): AppKitNetwork {
  return defineChain({
    id: chainId,
    caipNetworkId: `eip155:${chainId}`,
    chainNamespace: "eip155",

    name:
      chainLabelFor(chainId) ??
      "Fused AI chain",

    nativeCurrency:
      nativeCurrencyFor(chainId),

    rpcUrls: {
      default: {
        http: [rpcUrl],
      },
    },
  });
}

const robinhood = fusedChain(
  ROBINHOOD_TESTNET_CHAIN_ID,
  ROBINHOOD_TESTNET.rpcUrl,
);

const arc = fusedChain(
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET.rpcUrl,
);

const networks = [
  robinhood,
  arc,
] satisfies [
  AppKitNetwork,
  ...AppKitNetwork[],
];

const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
  ssr: true,
});

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,

  metadata: {
    name: "Fused AI",
    description: "Fused AI",
    url: "https://fused.ai",
    icons: ["/brand/fused-ai-logo.png"],
  },

  features: {
    analytics: false,
  },
});

export function Providers({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <WagmiProvider
      config={wagmiAdapter.wagmiConfig as Config}
    >
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
