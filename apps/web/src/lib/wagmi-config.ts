import { cookieStorage, createConfig, createStorage, http } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { anvil } from "viem/chains";
import { defineChain } from "viem";
import { chainLabelFor, walletConnectorKinds } from "./wallet.ts";

export type WalletRuntimeConfig = {
  chainId: number;
  rpcUrl: string;
  walletConnectProjectId: string | null;
};

export function createWalletConfig(wallet: WalletRuntimeConfig) {
  const name = chainLabelFor(wallet.chainId) ?? "Fused AI chain";
  const chain =
    wallet.chainId === 31337
      ? {
          ...anvil,
          name,
          rpcUrls: { default: { http: [wallet.rpcUrl] }, public: { http: [wallet.rpcUrl] } },
        }
      : defineChain({
          id: wallet.chainId,
          name,
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: { default: { http: [wallet.rpcUrl] } },
        });
  const kinds = walletConnectorKinds(wallet.walletConnectProjectId);
  const connectors = [
    injected({ shimDisconnect: true, unstable_shimAsyncInject: 2_000 }),
    ...(kinds.includes("walletConnect") && wallet.walletConnectProjectId
      ? [walletConnect({ projectId: wallet.walletConnectProjectId, showQrModal: true })]
      : []),
  ];
  return createConfig({
    chains: [chain],
    connectors,
    transports: { [chain.id]: http(wallet.rpcUrl) },
    ssr: true,
    storage: createStorage({ storage: cookieStorage }),
  });
}
