"use client";

import { WalletButton } from "@fused-ai/ui";
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";

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
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect, isPending: disconnecting } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const wrongNetwork = Boolean(isConnected && expectedChainId && chainId !== expectedChainId);
  const chainLabel = expectedChainId === 31337 ? "Fused Local" : chainId ? `Chain ${chainId}` : undefined;
  const injected = connectors.find((c) => c.id === "injected") ?? connectors[0];
  return (
    <WalletButton
      configured
      connected={isConnected}
      address={address}
      pending={isPending || disconnecting || switching}
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
