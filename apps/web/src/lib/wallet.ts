export type WriteClientReason = "account" | "rpc" | "wallet" | "chain";

export function walletConnectorKinds(projectId: string | null | undefined): ("injected" | "walletConnect")[] {
  if (projectId && projectId.trim()) return ["injected", "walletConnect"];
  return ["injected"];
}

export function writeClientError(reason: WriteClientReason): string {
  switch (reason) {
    case "account":
      return "Connect a wallet to continue.";
    case "chain":
      return "Switch your wallet to the Fused chain.";
    case "rpc":
      return "The local chain is not reachable.";
    case "wallet":
      return "Reconnect the wallet and try again.";
  }
}

export function chainLabelFor(chainId: number | null | undefined): string | undefined {
  if (!chainId) return undefined;
  return chainId === 31337 ? "Fused Local" : `Chain ${chainId}`;
}
