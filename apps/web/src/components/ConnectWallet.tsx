"use client";

import { useState } from "react";
import { WalletButton } from "@fused-ai/ui";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { chainLabelFor } from "../lib/wallet.ts";

export function ConnectWallet({
  configured,
  preferredChainId,
}: {
  configured: boolean;
  preferredChainId: number;
}) {
  if (!configured) return null;
  return <LiveWalletButton preferredChainId={preferredChainId} />;
}

function connectorLabel(connector: { id: string; name: string }): string {
  if (connector.id === "walletConnect") return "WalletConnect";
  if (connector.name === "Injected") return "Browser wallet";
  return connector.name;
}

function LiveWalletButton({ preferredChainId }: { preferredChainId: number }) {
  const { address, isConnected, status, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect, isPending: disconnecting } = useDisconnect();
  const [menuOpen, setMenuOpen] = useState(false);
  const reconnecting = status === "reconnecting" || status === "connecting";
  const pending = isPending || disconnecting || reconnecting;
  const connected = Boolean(address) || isConnected;
  const chainLabel = chainLabelFor(address || isConnected ? chainId : preferredChainId);

  return (
    <WalletButton
      configured
      connected={connected}
      address={address}
      pending={pending}
      chainLabel={chainLabel}
      connectorMenuOpen={menuOpen}
      onToggleConnectorMenu={() => setMenuOpen((open) => !open)}
      connectors={connectors.map((connector) => ({
        id: connector.id,
        name: connectorLabel(connector),
        onClick: () => {
          setMenuOpen(false);
          connect({ connector, chainId: preferredChainId });
        },
      }))}
      onConnect={() => {
        const injected = connectors.find((c) => c.id === "injected") ?? connectors[0];
        if (injected) connect({ connector: injected, chainId: preferredChainId });
      }}
      onDisconnect={() => disconnect()}
    />
  );
}
