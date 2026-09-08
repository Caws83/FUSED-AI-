export function walletConnectorKinds(projectId: string | null | undefined): ("injected" | "walletConnect")[] {
  if (projectId && projectId.trim()) return ["injected", "walletConnect"];
  return ["injected"];
}
