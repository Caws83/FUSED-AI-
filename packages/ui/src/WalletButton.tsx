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
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <span className="fused-muted" style={{ fontSize: 13 }}>
          {shortAddress(address)}
          {chainLabel ? ` · ${chainLabel}` : ""}
        </span>
        <Button type="button" variant="ghost" onClick={onDisconnect} disabled={pending}>
          {pending ? "Working…" : "Disconnect"}
        </Button>
      </span>
    );
  }
  if (connectors && connectors.length > 1) {
    return (
      <span style={{ display: "inline-flex", gap: 8 }}>
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
    <Button type="button" variant="secondary" onClick={onConnect} disabled={pending}>
      {label === "Connecting…" ? "Connecting…" : "Connect Wallet"}
    </Button>
  );
}
