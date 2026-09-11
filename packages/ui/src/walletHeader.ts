/** Header copy. Never "Reconnect Wallet" while an account address exists. */
export function walletHeaderCopy(input: {
  address?: string;
  connected?: boolean;
  pending?: boolean;
  wrongNetwork?: boolean;
}): "Switch Network" | "Disconnect" | "Connecting…" | "Connect Wallet" {
  const hasAccount = Boolean(input.address);
  if ((input.connected || hasAccount) && input.wrongNetwork) return "Switch Network";
  if (hasAccount) return "Disconnect";
  if (input.pending) return "Connecting…";
  return "Connect Wallet";
}
