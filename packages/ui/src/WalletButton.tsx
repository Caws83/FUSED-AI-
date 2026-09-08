import { Button } from "./Button.tsx";

export type WalletButtonProps = {
  configured: boolean;
  connected?: boolean;
  address?: string;
  pending?: boolean;
  wrongNetwork?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onSwitchNetwork?: () => void;
};

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletButton({
  configured,
  connected = false,
  address,
  pending = false,
  wrongNetwork = false,
  onConnect,
  onDisconnect,
  onSwitchNetwork,
}: WalletButtonProps) {
  if (!configured) return null;
  if (connected && wrongNetwork) {
    return (
      <Button type="button" variant="ghost" onClick={onSwitchNetwork} disabled={pending}>
        {pending ? "Switching…" : "Switch Network"}
      </Button>
    );
  }
  if (connected && address) {
    return (
      <Button type="button" variant="ghost" onClick={onDisconnect} disabled={pending}>
        {pending ? "Disconnecting…" : shortAddress(address)}
      </Button>
    );
  }
  return (
    <Button type="button" variant="secondary" onClick={onConnect} disabled={pending}>
      {pending ? "Connecting…" : "Connect Wallet"}
    </Button>
  );
}
