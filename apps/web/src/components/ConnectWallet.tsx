"use client";

import { WalletButton } from "@fused-ai/ui";
import { useAccount, useConnect, useDisconnect } from "wagmi";

export function ConnectWallet({ configured }: { configured: boolean }) {
  if (!configured) return null;
  return <LiveWalletButton />;
}

function LiveWalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect, isPending: disconnecting } = useDisconnect();
  const connector = connectors[0];
  return (
    <WalletButton
      configured
      connected={isConnected}
      address={address}
      pending={isPending || disconnecting}
      onConnect={() => {
        if (connector) connect({ connector });
      }}
      onDisconnect={() => disconnect()}
    />
  );
}
