import { Button } from "./Button.tsx";
import { walletHeaderCopy } from "./walletHeader.ts";

export type WalletConnectorChoice = {
  id: string;
  name: string;
  onClick: () => void;
};

export type WalletButtonProps = {
  configured: boolean;
  connected?: boolean;
  address?: string;
  pending?: boolean;
  wrongNetwork?: boolean;
  chainLabel?: string;
  connectors?: WalletConnectorChoice[];
  connectorMenuOpen?: boolean;
  onToggleConnectorMenu?: () => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onSwitchNetwork?: () => void;
};

export { walletHeaderCopy };

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletButton({
  configured,
  connected = false,
  address,
  pending = false,
  wrongNetwork = false,
  chainLabel,
  connectors,
  connectorMenuOpen = false,
  onToggleConnectorMenu,
  onConnect,
  onDisconnect,
  onSwitchNetwork,
}: WalletButtonProps) {
  if (!configured) return null;
  const hasAccount = Boolean(address);
  if ((connected || hasAccount) && wrongNetwork) {
    return (
      <Button type="button" variant="ghost" onClick={onSwitchNetwork} disabled={pending}>
        {pending ? "Switching…" : "Switch Network"}
      </Button>
    );
  }
  if (hasAccount && address) {
    return (
      <span className="fused-wallet-connected">
        <span className="fused-wallet-meta">
          {shortAddress(address)}
          {chainLabel ? <span className="fused-wallet-chain"> · {chainLabel}</span> : null}
        </span>
        <Button type="button" variant="ghost" onClick={onDisconnect} disabled={pending}>
          {pending ? "Working…" : "Disconnect"}
        </Button>
      </span>
    );
  }
  if (connectors && connectors.length > 0 && connectorMenuOpen) {
    return (
      <span className="fused-wallet-menu">
        {connectors.map((item) => (
          <Button key={item.id} type="button" variant="secondary" onClick={item.onClick} disabled={pending}>
            {pending ? "Connecting…" : item.name}
          </Button>
        ))}
      </span>
    );
  }
  const label = walletHeaderCopy({ connected, address, pending, wrongNetwork });
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={() => {
        if (connectors && connectors.length > 1 && onToggleConnectorMenu) {
          onToggleConnectorMenu();
          return;
        }
        onConnect?.();
      }}
      disabled={pending}
    >
      {label === "Connecting…" ? "Connecting…" : "Connect Wallet"}
    </Button>
  );
}
