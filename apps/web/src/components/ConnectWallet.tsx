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
  const connector = connectors[0];
  const wrongNetwork = Boolean(isConnected && expectedChainId && chainId !== expectedChainId);
  return (
    <WalletButton
      configured
      connected={isConnected}
      address={address}
      pending={isPending || disconnecting || switching}
      wrongNetwork={wrongNetwork}
      onConnect={() => {
        if (connector) connect({ connector });
      }}
      onDisconnect={() => disconnect()}
      onSwitchNetwork={() => {
        if (expectedChainId) switchChain({ chainId: expectedChainId });
      }}
    />
  );
}
