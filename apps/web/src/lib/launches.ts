import { createPublicClient, http, type Hex } from "viem";
import { loadEnv, loadRepoEnv, indexerFreshnessFromParts, indexedLaunchFactories, tradeFactoryForLaunch, nativeCurrencyFor, type FusedEnv, type IndexerFreshness } from "@fused-ai/config";
import { createDatabaseClient } from "@fused-ai/database";
import { createMediaStore, resolvePersistedLaunchImage } from "@fused-ai/media";
import { FUSED_FACTORY_ABI, LAUNCH_TOKEN_ABI, STATE_LABEL, ZERO_ADDRESS } from "@fused-ai/blockchain";
import type { IndexedLaunch } from "@fused-ai/types";

const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

export function createChainClient(env: Pick<FusedEnv, "rpcUrl" | "chainId">) {
  if (!env.rpcUrl || !env.chainId) return null;
  return createPublicClient({
    chain: {
      id: env.chainId,
      name: "fused",
      nativeCurrency: nativeCurrencyFor(env.chainId),
      rpcUrls: { default: { http: [env.rpcUrl] } },
    },
    transport: http(env.rpcUrl, { timeout: 20_000 }),
  });
}

export function marketToIndexedLaunch(input: {
  chainId: number;
  token: Hex;
  name: string;
  symbol: string;
  factory: Hex | null;
  locker: Hex | null;
  market: {
    creator: Hex;
    state: number;
    realQuote: bigint;
    totalSupply: bigint;
    circulating: bigint;
    graduationTarget: bigint;
    tokenId: bigint;
    createdAt: bigint;
    lpFee: number;
    priceX18: bigint;
  };
}): IndexedLaunch {
  const graduated = input.market.state === 2;
  return {
    chainId: input.chainId,
    token: input.token,
    name: input.name,
    symbol: input.symbol,
    launcher: input.market.creator,
    quote: ZERO_ADDRESS,
    poolId: null,
    tokenId: input.market.tokenId > 0n ? input.market.tokenId.toString() : "0",
    startTick: null,
    lpFee: Number(input.market.lpFee),
    supply: input.market.totalSupply.toString(),
    metadataURI: "",
    txHash: ZERO_HASH,
    blockNumber: 0n,
    createdAt: input.market.createdAt > 0n ? new Date(Number(input.market.createdAt) * 1000).toISOString() : null,
    factory: input.factory,
    locker: input.locker,
    dexVersion: graduated ? "uniswap_v4" : "curve",
    imageId: null,
    imageUrl: null,
    appDescription: null,
    sourcePlatform: null,
    sourcePostId: null,
    sourcePostUrl: null,
    sourceAuthor: null,
    sourceExcerpt: null,
    lifecycleState: STATE_LABEL[input.market.state] ?? "UNKNOWN",
    realQuote: input.market.realQuote.toString(),
    graduationTarget: input.market.graduationTarget.toString(),
    circulating: input.market.circulating.toString(),
    priceX18: input.market.priceX18.toString(),
    volumeQuote: null,
    holderCount: null,
  };
}

export async function readMarketOnFactories(
  client: NonNullable<ReturnType<typeof createChainClient>>,
  token: Hex,
  env: FusedEnv,
  preferredFactory?: string | null,
): Promise<{ factory: Hex; locker: Hex | null; market: Parameters<typeof marketToIndexedLaunch>[0]["market"] } | null> {
  const gens = indexedLaunchFactories(env.launch);
  const ordered = [
    ...gens.filter((g) => preferredFactory && g.factory.toLowerCase() === preferredFactory.toLowerCase()),
    ...gens.filter((g) => !preferredFactory || g.factory.toLowerCase() !== preferredFactory.toLowerCase()),
  ];
  for (const gen of ordered) {
    try {
      const market = await client.readContract({
        address: gen.factory as Hex,
        abi: FUSED_FACTORY_ABI,
        functionName: "getMarket",
        args: [token],
      });
      if (market.state === 0) continue;
      return {
        factory: gen.factory as Hex,
        locker: (gen.locker as Hex | null) ?? null,
        market,
      };
    } catch {
      /* try the next known factory */
    }
  }
  return null;
}

export async function loadOnchainLaunch(token: string, preferredFactory?: string | null): Promise<IndexedLaunch | null> {
  try {
    loadRepoEnv();
    const env = loadEnv();
    if (!env.rpcUrl || !env.chainId || !token?.startsWith("0x")) return null;
    if (indexedLaunchFactories(env.launch).length === 0) return null;
    const client = createChainClient(env);
    if (!client) return null;
    const address = token as Hex;
    const found = await readMarketOnFactories(client, address, env, preferredFactory);
    if (!found) return null;
    let name = "";
    let symbol = "";
    try {
      [name, symbol] = await Promise.all([
        client.readContract({ address, abi: LAUNCH_TOKEN_ABI, functionName: "name" }),
        client.readContract({ address, abi: LAUNCH_TOKEN_ABI, functionName: "symbol" }),
      ]);
    } catch {
      /* keep empty rather than invent */
    }
    return marketToIndexedLaunch({
      chainId: env.chainId,
      token: address,
      name,
      symbol,
      factory: found.factory,
      locker: found.locker,
      market: found.market,
    });
  } catch {
    return null;
  }
}

export function tradeFactoryAddress(launch: Pick<IndexedLaunch, "factory">, env: FusedEnv): `0x${string}` | null {
  const resolved = tradeFactoryForLaunch(launch.factory, env.launch);
  return resolved?.startsWith("0x") ? (resolved as `0x${string}`) : null;
}

export function hydrateLaunchImage(launch: IndexedLaunch, env: FusedEnv): IndexedLaunch {
  const store = createMediaStore(env);
  const resolved = resolvePersistedLaunchImage(
    { imageId: launch.imageId, imageUrl: launch.imageUrl },
    { chainId: env.chainId ?? launch.chainId, publicUrlForId: (id) => store.getPublicUrl(id) },
  );
  return { ...launch, imageId: resolved.imageId, imageUrl: resolved.imageUrl };
}

export async function loadIndexedLaunches(): Promise<IndexedLaunch[]> {
  try {
    loadRepoEnv();
    const env = loadEnv();
    if (!env.databaseUrl || !env.chainId) return [];
    const db = createDatabaseClient(env);
    const result = await db.listLaunches(env.chainId);
    await db.close();
    return result.ok ? result.value.map((launch) => hydrateLaunchImage(launch, env)) : [];
  } catch {
    return [];
  }
}

export async function loadIndexedLaunch(token: string): Promise<IndexedLaunch | null> {
  try {
    loadRepoEnv();
    const env = loadEnv();
    if (!env.databaseUrl || !env.chainId) return null;
    const db = createDatabaseClient(env);
    const result = await db.getLaunch(env.chainId, token);
    await db.close();
    if (!result.ok || !result.value) return null;
    return hydrateLaunchImage(result.value, env);
  } catch {
    return null;
  }
}

export async function loadLaunchPage(token: string): Promise<{ launch: IndexedLaunch; indexed: boolean } | null> {
  const indexed = await loadIndexedLaunch(token);
  if (indexed) {
    if (indexed.factory) return { launch: indexed, indexed: true };
    const onchain = await loadOnchainLaunch(token);
    if (onchain?.factory) {
      return { launch: { ...indexed, factory: onchain.factory, locker: onchain.locker ?? indexed.locker }, indexed: true };
    }
    return { launch: indexed, indexed: true };
  }
  const onchain = await loadOnchainLaunch(token);
  if (onchain) return { launch: onchain, indexed: false };
  return null;
}

export async function loadIndexerFreshness(launchCount = 0): Promise<IndexerFreshness> {
  loadRepoEnv();
  const env = loadEnv();
  let latestIndexedBlock: bigint | null = null;
  let latestRpcBlock: bigint | null = null;
  if (env.databaseUrl && env.chainId) {
    try {
      const db = createDatabaseClient(env);
      const cursor = await db.getCursor(env.chainId);
      await db.close();
      if (cursor.ok) latestIndexedBlock = cursor.value;
    } catch {
      /* keep null */
    }
  }
  const client = createChainClient(env);
  if (client) {
    try {
      latestRpcBlock = await client.getBlockNumber();
    } catch {
      /* keep null */
    }
  }
  return indexerFreshnessFromParts({
    databaseConfigured: Boolean(env.databaseUrl),
    launchCount,
    latestIndexedBlock,
    latestRpcBlock,
    lagAlertBlocks: env.indexer.lagAlertBlocks,
    confirmations: env.indexer.confirmations,
  });
}

export function boardEmptyCopy(
  indexing: boolean,
  kind: "live" | "newly" | "graduating" | "graduated",
): { title: string; body: string } {
  if (indexing) {
    return {
      title: "Indexing…",
      body: "On-chain launches are being read from Robinhood Testnet. Tokens do not disappear — they appear here when the indexer catches up.",
    };
  }
  if (kind === "live") return { title: "No live curves yet.", body: "New tokens appear here after a wallet launch." };
  if (kind === "newly") return { title: "No launches yet.", body: "The board fills as real launches land onchain." };
  if (kind === "graduating") return { title: "Nothing graduating yet.", body: "Tokens near the on-chain target show up here." };
  return { title: "No graduates yet.", body: "When a curve hits its target, locked Uniswap liquidity appears here." };
}
