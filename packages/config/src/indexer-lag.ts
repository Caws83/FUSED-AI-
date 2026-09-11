export type IndexerFreshness = {
  databaseConfigured: boolean;
  latestIndexedBlock: bigint | null;
  latestRpcBlock: bigint | null;
  lag: number | null;
  indexing: boolean;
};

/** Pure lag/UI state. No RPC, no secrets. */
export function indexerFreshnessFromParts(input: {
  databaseConfigured: boolean;
  launchCount: number;
  latestIndexedBlock: bigint | null;
  latestRpcBlock: bigint | null;
  lagAlertBlocks: number;
  confirmations: number;
}): IndexerFreshness {
  const lag =
    input.latestIndexedBlock != null && input.latestRpcBlock != null
      ? Number(input.latestRpcBlock > input.latestIndexedBlock ? input.latestRpcBlock - input.latestIndexedBlock : 0n)
      : null;
  const threshold = Math.max(0, input.lagAlertBlocks) + Math.max(0, input.confirmations);
  const neverIndexed = input.databaseConfigured && input.latestIndexedBlock == null;
  const behind = lag != null && lag > threshold;
  const rpcUnknown = input.latestRpcBlock == null;
  const indexing =
    !input.databaseConfigured ||
    neverIndexed ||
    behind ||
    (input.launchCount === 0 && (neverIndexed || rpcUnknown || behind));
  return {
    databaseConfigured: input.databaseConfigured,
    latestIndexedBlock: input.latestIndexedBlock,
    latestRpcBlock: input.latestRpcBlock,
    lag,
    indexing,
  };
}
