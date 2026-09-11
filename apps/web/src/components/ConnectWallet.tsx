"use client";

import { WalletButton } from "@fused-ai/ui";
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { chainLabelFor } from "../lib/wallet.ts";

export function ConnectWallet({
  configured,
  expectedChainId,
}: {
  configured: boolean;
  expectedChainId: number | null;
}) {
  if (!configured) return null;
  return <LiveWalletButton expectedChainId={expectedChainId} />;
}

function LiveWalletButton({ expectedChainId }: { expectedChainId: number | null }) {
  const { address, isConnected, status } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect, isPending: disconnecting } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const reconnecting = status === "reconnecting" || status === "connecting";
  const pending = isPending || disconnecting || switching || reconnecting;
  const connected = Boolean(address) || isConnected;
  const wrongNetwork = Boolean(connected && expectedChainId && chainId !== expectedChainId);
  const chainLabel = chainLabelFor(address || isConnected ? chainId : expectedChainId);
  const injected = connectors.find((c) => c.id === "injected") ?? connectors[0];
  return (
    <WalletButton
      configured
      connected={connected}
      address={address}
      pending={pending}
      wrongNetwork={wrongNetwork}
      chainLabel={chainLabel}
      connectors={connectors.map((connector) => ({
        id: connector.id,
        name: connector.id === "walletConnect" ? "WalletConnect" : connector.name === "Injected" ? "Browser wallet" : connector.name,
        onClick: () => connect({ connector }),
      }))}
      onConnect={() => {
        if (injected) connect({ connector: injected });
      }}
      onDisconnect={() => disconnect()}
      onSwitchNetwork={() => {
        if (expectedChainId) switchChain({ chainId: expectedChainId });
      }}
    />
  );
}
