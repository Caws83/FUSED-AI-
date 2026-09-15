"use client";

import { type ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, type State } from "wagmi";
import { createWalletConfig, type WalletRuntimeConfig } from "../lib/wagmi-config.ts";

export type { WalletRuntimeConfig };

const queryClient = new QueryClient();

export function Providers({
  wallet,
  initialState,
  children,
}: {
  wallet: WalletRuntimeConfig | null;
  initialState?: State;
  children: ReactNode;
}) {
  const [config] = useState(() => (wallet ? createWalletConfig(wallet) : null));

  if (!config) return children;
  return (
    <WagmiProvider config={config} initialState={initialState} reconnectOnMount>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
