import { Button } from "./Button.tsx";

export type WalletButtonProps = {
  configured: boolean;
  connected?: boolean;
  address?: string;
  pending?: boolean;
  disabledReason?: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
};

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletButton({
  configured,
  connected = false,
  address,
  pending = false,
  disabledReason = "Wallet not configured",
  onConnect,
  onDisconnect,
}: WalletButtonProps) {
  if (!configured) {
    return (
      <Button type="button" variant="ghost" disabled title={disabledReason}>
        {disabledReason}
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
