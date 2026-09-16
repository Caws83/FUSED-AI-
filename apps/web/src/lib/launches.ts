import { createPublicClient, http, type Hex } from "viem";
import {
  loadEnv,
  loadRepoEnv,
  indexerFreshnessFromParts,
  indexedLaunchFactories,
  tradeFactoryForLaunch,
  nativeCurrencyFor,
  launchContractsForChain,
  rpcUrlForChain,
  parseSupportedChainId,
  INDEXED_BOARD_CHAIN_IDS,
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_LAUNCH,
  ROBINHOOD_TESTNET_CHAIN_ID,
  type FusedEnv,
  type IndexerFreshness,
  type LaunchGeneration,
} from "@fused-ai/config";
import { createDatabaseClient } from "@fused-ai/database";
import { createMediaStore, resolvePersistedLaunchImage } from "@fused-ai/media";
import { FUSED_FACTORY_ABI, LAUNCH_TOKEN_ABI, STATE_LABEL, ZERO_ADDRESS } from "@fused-ai/blockchain";
import type { IndexedLaunch } from "@fused-ai/types";

const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

export type LaunchIdentity =
  | { status: "found"; launch: IndexedLaunch }
  | { status: "missing" }
  | { status: "ambiguous"; chainIds: number[] };

export function resolveLaunchIdentity(rows: IndexedLaunch[], requestedChainId: number | null): LaunchIdentity {
  if (requestedChainId != null) {
    const hit = rows.find((row) => row.chainId === requestedChainId);
    return hit ? { status: "found", launch: hit } : { status: "missing" };
  }
  if (rows.length === 0) return { status: "missing" };
  if (rows.length === 1) {
    const only = rows[0];
    if (!only) return { status: "missing" };
    return { status: "found", launch: only };
  }
  return { status: "ambiguous", chainIds: rows.map((row) => row.chainId) };
}

export function rpcUrlForLaunchChain(chainId: number, env: Pick<FusedEnv, "chainId" | "rpcUrl">): string | null {
  if (chainId === env.chainId && env.rpcUrl) return env.rpcUrl;
  return rpcUrlForChain(chainId);
}

export function launchGenerationsForChain(chainId: number, env: FusedEnv): LaunchGeneration[] {
  if (chainId === env.chainId && chainId !== ARC_TESTNET_CHAIN_ID) {
    return indexedLaunchFactories(env.launch);
  }
  if (chainId === ROBINHOOD_TESTNET_CHAIN_ID && env.chainId === ROBINHOOD_TESTNET_CHAIN_ID) {
    return indexedLaunchFactories(env.launch);
  }
  const mapped = launchContractsForChain(chainId);
  if (!mapped?.deployed || !mapped.factory) return [];
  return [
    {
      version: "v1",
      factory: mapped.factory,
      locker: mapped.locker,
      deployBlock: chainId === ARC_TESTNET_CHAIN_ID ? ARC_TESTNET_LAUNCH.deployBlock : null,
    },
  ];
}

export function createChainClientFor(chainId: number, rpcUrl: string) {
  return createPublicClient({
    chain: {
      id: chainId,
      name: "fused",
      nativeCurrency: nativeCurrencyFor(chainId),
      rpcUrls: { default: { http: [rpcUrl] } },
    },
    transport: http(rpcUrl, { timeout: 20_000 }),
  });
}

export function createChainClient(env: Pick<FusedEnv, "rpcUrl" | "chainId">) {
  if (!env.rpcUrl || !env.chainId) return null;
  return createChainClientFor(env.chainId, env.rpcUrl);
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
  gens: LaunchGeneration[],
  preferredFactory?: string | null,
): Promise<{ factory: Hex; locker: Hex | null; market: Parameters<typeof marketToIndexedLaunch>[0]["market"] } | null> {
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

export async function loadOnchainLaunch(
  token: string,
  preferredFactory?: string | null,
  chainId?: number | null,
): Promise<IndexedLaunch | null> {
  try {
    loadRepoEnv();
    const env = loadEnv();
    const resolvedChain = chainId ?? env.chainId;
    if (!resolvedChain || !token?.startsWith("0x")) return null;
    const rpcUrl = rpcUrlForLaunchChain(resolvedChain, env);
    if (!rpcUrl) return null;
    const gens = launchGenerationsForChain(resolvedChain, env);
    if (gens.length === 0) return null;
    const client = createChainClientFor(resolvedChain, rpcUrl);
    const address = token as Hex;
    const found = await readMarketOnFactories(client, address, gens, preferredFactory);
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
      chainId: resolvedChain,
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

export function tradeFactoryAddress(
  launch: Pick<IndexedLaunch, "factory" | "chainId">,
  env: FusedEnv,
): `0x${string}` | null {
  const chainId = launch.chainId;
  if (!chainId || !launch.factory) return null;
  if (chainId === ROBINHOOD_TESTNET_CHAIN_ID) {
    const resolved = tradeFactoryForLaunch(launch.factory, env.launch);
    return resolved?.startsWith("0x") ? (resolved as `0x${string}`) : null;
  }
  const mapped = launchContractsForChain(chainId);
  if (!mapped?.deployed || !mapped.factory) return null;
  if (mapped.factory.toLowerCase() !== launch.factory.toLowerCase()) return null;
  return mapped.factory.startsWith("0x") ? (mapped.factory as `0x${string}`) : null;
}

export function hydrateLaunchImage(launch: IndexedLaunch, env: FusedEnv): IndexedLaunch {
  const store = createMediaStore(env);
  const resolved = resolvePersistedLaunchImage(
    { imageId: launch.imageId, imageUrl: launch.imageUrl },
    { chainId: launch.chainId, publicUrlForId: (id) => store.getPublicUrl(id) },
  );
  return { ...launch, imageId: resolved.imageId, imageUrl: resolved.imageUrl };
}

export async function loadIndexedLaunches(): Promise<IndexedLaunch[]> {
  try {
    loadRepoEnv();
    const env = loadEnv();
    if (!env.databaseUrl) return [];
    const db = createDatabaseClient(env);
    const result = await db.listLaunchesForChains([...INDEXED_BOARD_CHAIN_IDS]);
    await db.close();
    return result.ok ? result.value.map((launch) => hydrateLaunchImage(launch, env)) : [];
  } catch {
    return [];
  }
}

export async function loadIndexedLaunch(token: string, chainId?: number | null): Promise<LaunchIdentity> {
  try {
    loadRepoEnv();
    const env = loadEnv();
    if (!env.databaseUrl || !token?.startsWith("0x")) return { status: "missing" };
    const db = createDatabaseClient(env);
    const result = chainId != null ? await db.getLaunch(chainId, token) : await db.findLaunchesByToken(token);
    await db.close();
    if (!result.ok) return { status: "missing" };
    const rows = Array.isArray(result.value) ? result.value : result.value ? [result.value] : [];
    const identity = resolveLaunchIdentity(rows, chainId ?? null);
    if (identity.status !== "found") return identity;
    return { status: "found", launch: hydrateLaunchImage(identity.launch, env) };
  } catch {
    return { status: "missing" };
  }
}

export async function loadLaunchPage(
  token: string,
  chainId?: number | null,
): Promise<{ launch: IndexedLaunch; indexed: boolean } | null> {
  const requested = chainId ?? null;
  const indexed = await loadIndexedLaunch(token, requested);
  if (indexed.status === "ambiguous") return null;
  if (indexed.status === "found") {
    if (indexed.launch.factory) return { launch: indexed.launch, indexed: true };
    const onchain = await loadOnchainLaunch(token, indexed.launch.factory, indexed.launch.chainId);
    if (onchain?.factory) {
      return { launch: { ...indexed.launch, factory: onchain.factory, locker: onchain.locker ?? indexed.launch.locker }, indexed: true };
    }
    return { launch: indexed.launch, indexed: true };
  }
  if (requested == null) {
    const onchain = await loadOnchainLaunch(token);
    if (onchain) return { launch: onchain, indexed: false };
    return null;
  }
  const onchain = await loadOnchainLaunch(token, null, requested);
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
      body: "On-chain launches are being read from Robinhood Mainnet and Arc Testnet. Tokens do not disappear — they appear here when the indexer catches up.",
    };
  }
  if (kind === "live") return { title: "No live curves yet.", body: "New tokens appear here after a wallet launch." };
  if (kind === "newly") return { title: "No launches yet.", body: "The board fills as real launches land onchain." };
  if (kind === "graduating") return { title: "Nothing graduating yet.", body: "Tokens near the on-chain target show up here." };
  return { title: "No graduates yet.", body: "When a curve hits its target, locked Uniswap liquidity appears here." };
}

export { parseSupportedChainId };
