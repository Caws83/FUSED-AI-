import { createPublicClient, http, parseEventLogs, type Hex, type Log } from "viem";
import { loadEnv, type FusedEnv } from "@fused-ai/config";
import { createDatabaseClient, type DatabaseClient, type LaunchInsert } from "@fused-ai/database";
import { LAUNCH_FACTORY_ABI, LAUNCH_TOKEN_ABI } from "@fused-ai/blockchain";

const ZERO = "0x0000000000000000000000000000000000000000";

export type IndexerRunResult = {
  started: true;
  fromBlock: bigint;
  toBlock: bigint;
  indexed: number;
};

export function createRpc(env: FusedEnv) {
  if (!env.rpcUrl || !env.chainId) return null;
  return createPublicClient({
    chain: {
      id: env.chainId,
      name: "fused-local",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [env.rpcUrl] } },
    },
    transport: http(env.rpcUrl),
  });
}

export async function enrichLaunch(
  client: NonNullable<ReturnType<typeof createRpc>>,
  row: Omit<LaunchInsert, "name" | "symbol"> & { name?: string; symbol?: string; metadataURI: string },
): Promise<LaunchInsert> {
  let name = row.name ?? "";
  let symbol = row.symbol ?? "";
  try {
    const [n, s] = await Promise.all([
      client.readContract({ address: row.token, abi: LAUNCH_TOKEN_ABI, functionName: "name" }),
      client.readContract({ address: row.token, abi: LAUNCH_TOKEN_ABI, functionName: "symbol" }),
    ]);
    name = n;
    symbol = s;
  } catch {
    /* token might not be readable yet; keep event metadata */
  }
  return { ...row, name, symbol };
}

export function launchedToInsert(
  env: FusedEnv,
  log: Log,
  args: {
    token: Hex;
    tokenId: bigint;
    launcher: Hex;
    quote: Hex;
    poolId: Hex;
    startTick: number;
    lpFee: number;
    supply: bigint;
    metadataURI: string;
  },
  blockTime: Date | null,
): Omit<LaunchInsert, "name" | "symbol"> & { name?: string; symbol?: string; metadataURI: string } {
  return {
    chainId: env.chainId ?? 0,
    token: args.token,
    launcher: args.launcher,
    quote: args.quote || ZERO,
    poolId: args.poolId,
    tokenId: args.tokenId.toString(),
    startTick: Number(args.startTick),
    lpFee: Number(args.lpFee),
    supply: args.supply.toString(),
    metadataURI: args.metadataURI,
    txHash: log.transactionHash as Hex,
    blockNumber: log.blockNumber ?? 0n,
    createdAt: blockTime,
    factory: env.launchFactory as Hex | null,
    locker: env.launchLocker as Hex | null,
    dexVersion: "v4",
  };
}

export async function applyRange(env: FusedEnv, db: DatabaseClient, fromBlock: bigint, toBlock: bigint): Promise<number> {
  const client = createRpc(env);
  if (!client || !env.launchFactory || !env.chainId) return 0;
  const logs = await client.getLogs({
    address: env.launchFactory as Hex,
    event: LAUNCH_FACTORY_ABI.find((x) => x.type === "event" && x.name === "Launched"),
    fromBlock,
    toBlock,
  });
  let count = 0;
  for (const log of logs) {
    const parsed = parseEventLogs({
      abi: LAUNCH_FACTORY_ABI,
      logs: [log],
      eventName: "Launched",
    })[0];
    if (!parsed) continue;
    const args = parsed.args;
    let blockTime: Date | null = null;
    if (log.blockNumber != null) {
      const block = await client.getBlock({ blockNumber: log.blockNumber });
      blockTime = new Date(Number(block.timestamp) * 1000);
    }
    const base = launchedToInsert(
      env,
      log,
      {
        token: args.token,
        tokenId: args.tokenId,
        launcher: args.launcher,
        quote: args.quote,
        poolId: args.poolId,
        startTick: args.startTick,
        lpFee: args.lpFee,
        supply: args.supply,
        metadataURI: args.metadataURI,
      },
      blockTime,
    );
    const row = await enrichLaunch(client, base);
    const saved = await db.upsertLaunch(row);
    if (saved.ok) count += 1;
  }
  return count;
}

export async function pollOnce(env: FusedEnv = loadEnv(), db: DatabaseClient = createDatabaseClient(env)): Promise<IndexerRunResult | { started: false; reason: unknown }> {
  const checks = [db.availability(), env.rpcUrl && env.chainId ? { status: "OK" as const } : { status: "NOT_CONFIGURED" as const }, env.launchFactory ? { status: "OK" as const } : { status: "NOT_CONFIGURED" as const }];
  const blocked = checks.find((c) => c.status !== "OK");
  if (blocked) return { started: false, reason: blocked };

  const migrated = await db.migrate();
  if (!migrated.ok) return { started: false, reason: migrated.error };

  const client = createRpc(env);
  if (!client || !env.chainId) return { started: false, reason: { status: "NOT_CONFIGURED" } };

  const head = await client.getBlockNumber();
  const confirm = BigInt(env.indexer.confirmations);
  const toBlock = head >= confirm ? head - confirm : 0n;
  const cursor = await db.getCursor(env.chainId);
  const start = env.indexer.startBlock != null ? BigInt(env.indexer.startBlock) : 0n;
  const overlap = BigInt(env.indexer.overlapBlocks);
  let fromBlock = start;
  if (cursor.ok && cursor.value != null) {
    fromBlock = cursor.value > overlap ? cursor.value - overlap : 0n;
    if (fromBlock < start) fromBlock = start;
  }
  if (toBlock < fromBlock) {
    return { started: true, fromBlock, toBlock, indexed: 0 };
  }

  const indexed = await applyRange(env, db, fromBlock, toBlock);
  await db.setCursor(env.chainId, toBlock);
  return { started: true, fromBlock, toBlock, indexed };
}
