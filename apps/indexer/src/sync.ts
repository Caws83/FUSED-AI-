import { createPublicClient, fallback, http, parseEventLogs, type Hex, type Log } from "viem";
import {
  loadEnv,
  indexedLaunchFactories,
  sameAddress,
  type FusedEnv,
  type LaunchGeneration,
} from "@fused-ai/config";
import { createDatabaseClient, type DatabaseClient, type LaunchInsert } from "@fused-ai/database";
import {
  ERC20_ABI,
  FUSED_FACTORY_ABI,
  LAUNCH_FACTORY_ABI,
  LAUNCH_TOKEN_ABI,
  STATE_LABEL,
  tradePriceX18,
  venueName,
  ZERO_ADDRESS,
} from "@fused-ai/blockchain";

const ZERO = ZERO_ADDRESS;
const DEAD = "0x000000000000000000000000000000000000dead";

export type IndexerRunResult = {
  started: true;
  fromBlock: bigint;
  toBlock: bigint;
  indexed: number;
};

export function chunkBlockRange(fromBlock: bigint, toBlock: bigint, maxBlocks: bigint): Array<{ from: bigint; to: bigint }> {
  if (toBlock < fromBlock) return [];
  const size = maxBlocks < 1n ? 1n : maxBlocks;
  const chunks: Array<{ from: bigint; to: bigint }> = [];
  let from = fromBlock;
  while (from <= toBlock) {
    const to = from + size - 1n > toBlock ? toBlock : from + size - 1n;
    chunks.push({ from, to });
    from = to + 1n;
  }
  return chunks;
}

export function resumeFromBlock(start: bigint, cursor: bigint | null, overlap: bigint): bigint {
  let from = start;
  if (cursor != null) {
    from = cursor > overlap ? cursor - overlap : 0n;
    if (from < start) from = start;
  }
  return from;
}

export function uniqueFactories(gens: LaunchGeneration[]): LaunchGeneration[] {
  const out: LaunchGeneration[] = [];
  const seen = new Set<string>();
  for (const gen of gens) {
    const key = gen.factory.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(gen);
  }
  return out;
}

export async function withRpcRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** i));
    }
  }
  throw last;
}

export function createRpc(env: FusedEnv) {
  if (!env.rpcUrl || !env.chainId) return null;
  const urls = [env.rpcUrl, env.rpcUrlFallback].filter((u): u is string => Boolean(u));
  const transports = urls.map((url) => http(url, { timeout: 30_000, retryCount: 2, retryDelay: 1_000 }));
  const primary = transports[0];
  if (!primary) return null;
  return createPublicClient({
    chain: {
      id: env.chainId,
      name: "fused",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [env.rpcUrl] } },
    },
    transport: transports.length > 1 ? fallback(transports) : primary,
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
  factory: Hex,
  locker: Hex | null,
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
    factory,
    locker,
    dexVersion: "v4",
    lifecycleState: "GRADUATED",
  };
}

export function createdToInsert(
  env: FusedEnv,
  log: Log,
  args: {
    token: Hex;
    creator: Hex;
    supply: bigint;
    virtualQuote: bigint;
    virtualToken: bigint;
    graduationTarget: bigint;
    metadataURI: string;
  },
  blockTime: Date | null,
  factory: Hex,
  locker: Hex | null,
): Omit<LaunchInsert, "name" | "symbol"> & { name?: string; symbol?: string; metadataURI: string } {
  return {
    chainId: env.chainId ?? 0,
    token: args.token,
    launcher: args.creator,
    quote: ZERO,
    poolId: null,
    tokenId: "0",
    startTick: 0,
    lpFee: 0,
    supply: args.supply.toString(),
    metadataURI: args.metadataURI,
    txHash: log.transactionHash as Hex,
    blockNumber: log.blockNumber ?? 0n,
    createdAt: blockTime,
    factory,
    locker,
    dexVersion: "curve",
    lifecycleState: "CURVE",
    graduationTarget: args.graduationTarget.toString(),
  };
}

async function blockTimeOf(
  client: NonNullable<ReturnType<typeof createRpc>>,
  log: Log,
): Promise<Date | null> {
  if (log.blockNumber == null) return null;
  const block = await client.getBlock({ blockNumber: log.blockNumber });
  return new Date(Number(block.timestamp) * 1000);
}

async function refreshMarket(
  env: FusedEnv,
  client: NonNullable<ReturnType<typeof createRpc>>,
  db: DatabaseClient,
  token: Hex,
  factory: Hex,
): Promise<void> {
  if (!env.chainId) return;
  try {
    const v = await client.readContract({
      address: factory,
      abi: FUSED_FACTORY_ABI,
      functionName: "getMarket",
      args: [token],
    });
    if (v.state === 0) return;
    const graduated = v.state === 2;
    await db.updateMarket({
      chainId: env.chainId,
      token,
      lifecycleState: STATE_LABEL[v.state] ?? "UNKNOWN",
      realQuote: v.realQuote.toString(),
      graduationTarget: v.graduationTarget.toString(),
      circulating: v.circulating.toString(),
      priceX18: v.priceX18.toString(),
      tokenId: v.tokenId > 0n ? v.tokenId.toString() : null,
      poolId: null,
      dexVersion: graduated ? "uniswap_v4" : "curve",
    });
  } catch {
    /* LaunchFactory (no getMarket) or unknown token */
  }
}

export async function applyRange(
  env: FusedEnv,
  db: DatabaseClient,
  fromBlock: bigint,
  toBlock: bigint,
  gen: LaunchGeneration,
): Promise<number> {
  const client = createRpc(env);
  if (!client || !env.chainId) return 0;
  const factory = gen.factory as Hex;
  const locker = (gen.locker as Hex | null) ?? null;
  let count = 0;

  const createdLogs = await withRpcRetry(() =>
    client.getLogs({
      address: factory,
      event: FUSED_FACTORY_ABI.find((x) => x.type === "event" && x.name === "Created"),
      fromBlock,
      toBlock,
    }),
  );
  for (const log of createdLogs) {
    const parsed = parseEventLogs({ abi: FUSED_FACTORY_ABI, logs: [log], eventName: "Created" })[0];
    if (!parsed) continue;
    const logFactory = (log.address as Hex | undefined) ?? factory;
    const base = createdToInsert(env, log, parsed.args, await blockTimeOf(client, log), logFactory, locker);
    const row = await enrichLaunch(client, base);
    const saved = await db.upsertLaunch(row);
    if (saved.ok) count += 1;
    await refreshMarket(env, client, db, parsed.args.token, logFactory);
  }

  const launchedLogs = await withRpcRetry(() =>
    client.getLogs({
      address: factory,
      event: LAUNCH_FACTORY_ABI.find((x) => x.type === "event" && x.name === "Launched"),
      fromBlock,
      toBlock,
    }),
  );
  for (const log of launchedLogs) {
    const parsed = parseEventLogs({ abi: LAUNCH_FACTORY_ABI, logs: [log], eventName: "Launched" })[0];
    if (!parsed) continue;
    const logFactory = (log.address as Hex | undefined) ?? factory;
    const base = launchedToInsert(env, log, parsed.args, await blockTimeOf(client, log), logFactory, locker);
    const row = await enrichLaunch(client, base);
    const saved = await db.upsertLaunch(row);
    if (saved.ok) count += 1;
  }

  const tradeLogs = await withRpcRetry(() =>
    client.getLogs({
      address: factory,
      event: FUSED_FACTORY_ABI.find((x) => x.type === "event" && x.name === "Trade"),
      fromBlock,
      toBlock,
    }),
  );
  for (const log of tradeLogs) {
    const parsed = parseEventLogs({ abi: FUSED_FACTORY_ABI, logs: [log], eventName: "Trade" })[0];
    if (!parsed) continue;
    const args = parsed.args;
    let price = args.priceX18;
    if (price === 0n) price = tradePriceX18(args.quoteAmount, args.tokenAmount);
    await db.insertTrade({
      chainId: env.chainId,
      token: args.token,
      txHash: log.transactionHash as Hex,
      logIndex: Number(log.logIndex ?? 0),
      blockNumber: log.blockNumber ?? 0n,
      tradedAt: (await blockTimeOf(client, log)) ?? new Date(),
      trader: args.trader,
      isBuy: args.isBuy,
      tokenAmount: args.tokenAmount.toString(),
      quoteAmount: args.quoteAmount.toString(),
      priceX18: price.toString(),
      venue: venueName(Number(args.venue)),
    });
    count += 1;
    const logFactory = (log.address as Hex | undefined) ?? factory;
    await refreshMarket(env, client, db, args.token, logFactory);
  }

  const graduatedLogs = await withRpcRetry(() =>
    client.getLogs({
      address: factory,
      event: FUSED_FACTORY_ABI.find((x) => x.type === "event" && x.name === "Graduated"),
      fromBlock,
      toBlock,
    }),
  );
  for (const log of graduatedLogs) {
    const parsed = parseEventLogs({ abi: FUSED_FACTORY_ABI, logs: [log], eventName: "Graduated" })[0];
    if (!parsed) continue;
    await db.updateMarket({
      chainId: env.chainId,
      token: parsed.args.token,
      lifecycleState: "GRADUATED",
      realQuote: "0",
      graduationTarget: "0",
      circulating: "0",
      priceX18: "0",
      tokenId: parsed.args.tokenId.toString(),
      poolId: parsed.args.poolId,
      dexVersion: "uniswap_v4",
    });
    const logFactory = (log.address as Hex | undefined) ?? factory;
    await refreshMarket(env, client, db, parsed.args.token, logFactory);
    count += 1;
  }

  const known = await db.listLaunches(env.chainId);
  const tokens = known.ok
    ? known.value
        .filter((row) => {
          if (sameAddress(row.factory, factory)) return true;
          if (!row.factory && gen.version === "v1") return true;
          return false;
        })
        .map((row) => row.token as Hex)
    : [];
  if (tokens.length > 0) {
    const transferLogs = await withRpcRetry(() =>
      client.getLogs({
        address: tokens,
        event: ERC20_ABI.find((x) => x.type === "event" && x.name === "Transfer"),
        fromBlock,
        toBlock,
      }),
    );
    for (const log of transferLogs) {
      const parsed = parseEventLogs({ abi: ERC20_ABI, logs: [log], eventName: "Transfer" })[0];
      if (!parsed || !log.address) continue;
      const from = parsed.args.from.toLowerCase();
      const to = parsed.args.to.toLowerCase();
      if (from === DEAD && to === DEAD) continue;
      await db.applyTransfer({
        chainId: env.chainId,
        token: log.address,
        from: parsed.args.from,
        to: parsed.args.to,
        value: parsed.args.value.toString(),
        txHash: (log.transactionHash as Hex | undefined) ?? undefined,
        logIndex: log.logIndex == null ? undefined : Number(log.logIndex),
      });
    }
  }

  return count;
}

async function fromBlockForFactory(
  env: FusedEnv,
  db: DatabaseClient,
  gen: LaunchGeneration,
  chainCursor: bigint | null,
): Promise<bigint> {
  const start =
    gen.deployBlock != null
      ? BigInt(gen.deployBlock)
      : env.indexer.startBlock != null
        ? BigInt(env.indexer.startBlock)
        : 0n;
  const stored = env.chainId ? await db.getFactoryCursor(env.chainId, gen.factory as Hex) : { ok: true as const, value: null };
  let cursor = stored.ok ? stored.value : null;
  if (cursor == null && gen.version === "v1") cursor = chainCursor;
  return resumeFromBlock(start, cursor, BigInt(env.indexer.overlapBlocks));
}

export async function pollOnce(env: FusedEnv = loadEnv(), db: DatabaseClient = createDatabaseClient(env)): Promise<IndexerRunResult | { started: false; reason: unknown }> {
  const factories = uniqueFactories(indexedLaunchFactories(env.launch));
  const checks = [
    db.availability(),
    env.rpcUrl && env.chainId ? { status: "OK" as const } : { status: "NOT_CONFIGURED" as const },
    factories.length > 0 ? { status: "OK" as const } : { status: "NOT_CONFIGURED" as const },
  ];
  const blocked = checks.find((c) => c.status !== "OK");
  if (blocked) return { started: false, reason: blocked };

  const migrated = await db.migrate();
  if (!migrated.ok) return { started: false, reason: migrated.error };

  const client = createRpc(env);
  if (!client || !env.chainId) return { started: false, reason: { status: "NOT_CONFIGURED" } };

  const head = await withRpcRetry(() => client.getBlockNumber());
  const confirm = BigInt(env.indexer.confirmations);
  const toBlock = head >= confirm ? head - confirm : 0n;
  const chainCursor = await db.getCursor(env.chainId);
  const chainBlock = chainCursor.ok ? chainCursor.value : null;

  let indexed = 0;
  let earliestFrom = toBlock;
  let latestTo = 0n;
  const factoryHeads: bigint[] = [];

  for (const gen of factories) {
    const fromBlock = await fromBlockForFactory(env, db, gen, chainBlock);
    if (fromBlock < earliestFrom) earliestFrom = fromBlock;
    if (toBlock < fromBlock) {
      factoryHeads.push(fromBlock);
      continue;
    }
    const chunks = chunkBlockRange(fromBlock, toBlock, BigInt(env.indexer.maxRangeBlocks));
    let lastTo = fromBlock;
    for (const chunk of chunks) {
      indexed += await applyRange(env, db, chunk.from, chunk.to, gen);
      await db.setFactoryCursor(env.chainId, gen.factory as Hex, chunk.to);
      lastTo = chunk.to;
    }
    factoryHeads.push(lastTo);
    if (lastTo > latestTo) latestTo = lastTo;
  }

  if (factoryHeads.length > 0) {
    const minHead = factoryHeads.reduce((a, b) => (a < b ? a : b));
    await db.setCursor(env.chainId, minHead);
  }

  return { started: true, fromBlock: earliestFrom, toBlock: latestTo || toBlock, indexed };
}
