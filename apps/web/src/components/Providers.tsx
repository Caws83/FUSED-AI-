"use client";

import { useEffect, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, type Config } from "wagmi";
import { defineChain, type AppKitNetwork } from "@reown/appkit/networks";
import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import {
  ARC_MAINNET,
  ARC_MAINNET_CHAIN_ID,
  ROBINHOOD_MAINNET,
  ROBINHOOD_MAINNET_CHAIN_ID,
} from "@fused-ai/config/public";
import { chainLabelFor, nativeCurrencyFor } from "../lib/wallet.ts";
import { ThemeProvider, useTheme } from "./ThemeProvider.tsx";

const queryClient = new QueryClient();

export type WalletRuntimeConfig = {
  chainId: number;
  rpcUrl: string;
  walletConnectProjectId: string | null;
};

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

function fusedChain(chainId: number, rpcUrl: string, explorer: string): AppKitNetwork {
  return defineChain({
    id: chainId,
    caipNetworkId: `eip155:${chainId}`,
    chainNamespace: "eip155",
    name: chainLabelFor(chainId) ?? "Fused AI chain",
    nativeCurrency: nativeCurrencyFor(chainId),
    rpcUrls: { default: { http: [rpcUrl] } },
    blockExplorers: { default: { name: chainLabelFor(chainId) ?? "Explorer", url: explorer } },
  });
}

const robinhoodMainnet = fusedChain(
  ROBINHOOD_MAINNET_CHAIN_ID,
  ROBINHOOD_MAINNET.rpcUrl,
  ROBINHOOD_MAINNET.explorer,
);

const arcMainnet = fusedChain(ARC_MAINNET_CHAIN_ID, ARC_MAINNET.rpcUrl, ARC_MAINNET.explorer);

const networks = [robinhoodMainnet, arcMainnet] satisfies [AppKitNetwork, ...AppKitNetwork[]];

const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
  ssr: true,
});

type FusedAppKit = ReturnType<typeof createAppKit>;

const globalRef = globalThis as typeof globalThis & {
  __fusedAppKit?: boolean;
  __fusedAppKitInstance?: FusedAppKit;
};
if (!globalRef.__fusedAppKit) {
  globalRef.__fusedAppKitInstance = createAppKit({
    adapters: [wagmiAdapter],
    networks,
    projectId,
    themeMode: "dark",
    allowUnsupportedChain: true,
    defaultNetwork: robinhoodMainnet,
    metadata: {
      name: "FUSED AI",
      description: "Launch a token from a post.",
      url: "https://www.fusedai.org",
      icons: ["https://www.fusedai.org/brand/fused-ai-logo.png"],
    },
    features: {
      analytics: false,
      email: false,
      socials: false,
      swaps: false,
      onramp: false,
    },
  });
  globalRef.__fusedAppKit = true;
}

function AppKitThemeSync() {
  const { theme } = useTheme();
  useEffect(() => {
    const kit = globalRef.__fusedAppKitInstance as { setThemeMode?: (mode: "light" | "dark") => void } | undefined;
    try {
      kit?.setThemeMode?.(theme);
    } catch {
      /* AppKit may be unavailable before init */
    }
  }, [theme]);
  return null;
}

export function Providers({
  children,
  initialTheme = "dark",
}: {
  children: ReactNode;
  wallet?: WalletRuntimeConfig | null;
  initialTheme?: "light" | "dark";
}) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig as Config}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider initialTheme={initialTheme}>
          <AppKitThemeSync />
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
