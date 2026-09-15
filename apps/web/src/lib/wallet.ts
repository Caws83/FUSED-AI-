export type WriteClientReason = "account" | "rpc" | "wallet" | "chain";

export { chainLabelFor, nativeCurrencyFor } from "@fused-ai/config/public";

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
