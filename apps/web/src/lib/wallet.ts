export type WriteClientReason = "account" | "rpc" | "wallet" | "chain";

export {
  chainLabelFor,
  isWalletSelectorChain,
  launchContractsForChain,
  nativeCurrencyFor,
  newLaunchForWallet,
} from "@fused-ai/config/public";

export function asLaunchAddress(value: string | null | undefined): `0x${string}` | null {
  if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value)) return null;
  return value as `0x${string}`;
}

export function walletConnectorKinds(projectId: string | null | undefined): ("injected" | "walletConnect")[] {
  if (projectId && projectId.trim()) return ["injected", "walletConnect"];
  return ["injected"];
}

export function writeClientError(reason: WriteClientReason): string {
  switch (reason) {
    case "account":
      return "Connect a wallet to continue.";
    case "chain":
      return "Switch your wallet to this network.";
    case "rpc":
      return "The chain is not reachable.";
    case "wallet":
      return "Confirm in your wallet.";
  }
}
