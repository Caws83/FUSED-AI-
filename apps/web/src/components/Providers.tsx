"use client";

import { type ReactNode, useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, type Config, http } from "wagmi";
import { anvil } from "viem/chains";

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

export type WalletRuntimeConfig = {
  chainId: number;
  rpcUrl: string;
  walletConnectProjectId: string | null;
};

const queryClient = new QueryClient();

function fusedChain(chainId: number, rpcUrl: string): AppKitNetwork {
  return defineChain({
    id: chainId,
    caipNetworkId: `eip155:${chainId}`,
    chainNamespace: "eip155",

    name: chainLabelFor(chainId) ?? "Fused AI chain",

    nativeCurrency: nativeCurrencyFor(chainId),

    rpcUrls: {
      default: {
        http: [rpcUrl],
      },
    },
  });
}

export function Providers({
  wallet,
  children,
}: {
  wallet: WalletRuntimeConfig | null;
  children: ReactNode;
}) {
  const setup = useMemo(() => {
    if (
      !wallet?.walletConnectProjectId ||
      !wallet.rpcUrl
    ) {
      return null;
    }

    const projectId = wallet.walletConnectProjectId;

    const robinhoodRpc =
      wallet.chainId === ROBINHOOD_TESTNET_CHAIN_ID
        ? wallet.rpcUrl
        : ROBINHOOD_TESTNET.rpcUrl;

    const arcRpc =
      wallet.chainId === ARC_TESTNET_CHAIN_ID
        ? wallet.rpcUrl
        : ARC_TESTNET.rpcUrl;

    const robinhood = fusedChain(
      ROBINHOOD_TESTNET_CHAIN_ID,
      robinhoodRpc,
    );

    const arc = fusedChain(
      ARC_TESTNET_CHAIN_ID,
      arcRpc,
    );

const local: AppKitNetwork = defineChain({
  id: 31337,
  caipNetworkId: "eip155:31337",
  chainNamespace: "eip155",

  name: chainLabelFor(31337) ?? "Fused Local",

  nativeCurrency: anvil.nativeCurrency,

  rpcUrls: {
    default: {
      http: [wallet.rpcUrl],
    },
  },
});

    const networks =
  wallet.chainId === 31337
    ? ([local, robinhood, arc] satisfies [
        AppKitNetwork,
        ...AppKitNetwork[],
      ])
    : ([robinhood, arc] satisfies [
        AppKitNetwork,
        ...AppKitNetwork[],
      ]);

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
        url:
          typeof window !== "undefined"
            ? window.location.origin
            : "https://fused.ai",
        icons: ["/brand/fused-ai-logo.png"],
      },

      features: {
        analytics: false,
      },
    });

    return {
      config: wagmiAdapter.wagmiConfig as Config,
    };
  }, [wallet]);

  if (!setup) {
    return children;
  }

  return (
    <WagmiProvider config={setup.config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}