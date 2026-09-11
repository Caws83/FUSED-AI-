import {
  AVAILABILITY_STATUS,
  notConfigured,
  type Availability,
  type TrendingWeights,
} from "@fused-ai/types";
import { loadPublicEnv, publicWalletAvailability, type PublicEnv } from "./public-env.ts";
import { mergeLocalDeployment } from "./deployment.ts";
import { isPublicLaunchEnabled, isPublicChainConfigured, isStatusPageEnabled } from "./features.ts";
import {
  isProductionEnv,
  shouldRejectAnvilAddress,
  shouldRejectLocalhostUrl,
} from "./production-safety.ts";

export type { PublicEnv };

export type ConfigState = "configured" | "not_configured" | "invalid";

export type FusedEnv = {
  siteUrl: string;
  databaseUrl: string | null;
  chainId: number | null;
  rpcUrl: string | null;
  rpcUrlFallback: string | null;
  launchFactory: string | null;
  launchLocker: string | null;
  launchDeployBlock: number | null;
  uniswap: {
    poolManager: string | null;
    positionManager: string | null;
    stateView: string | null;
    quoter: string | null;
    universalRouter: string | null;
    permit2: string | null;
    v3Factory: string | null;
    v2Factory: string | null;
  };
  social: {
    provider: string | null;
    bearerToken: string | null;
    apiKey: string | null;
    apiSecret: string | null;
    trackedAccountsPath: string | null;
    lastSync: string | null;
    weights: TrendingWeights;
  };
  media: {
    store: string | null;
    localPath: string | null;
    publicBase: string | null;
    awsAccessKeyId: string | null;
    awsSecretAccessKey: string | null;
    awsEndpoint: string | null;
    awsRegion: string | null;
    bucket: string | null;
  };
  aiImageProvider: string | null;
  aiImage: {
    provider: string | null;
    apiKey: string | null;
    apiBaseUrl: string | null;
    model: string | null;
  };
  ai: {
    provider: string | null;
    apiKey: string | null;
    apiBaseUrl: string | null;
    model: string | null;
    maxOutputTokens: number;
    timeoutMs: number;
  };
  tokenizedAssetRegistryPath: string | null;
  imageStore: string | null;
  indexer: {
    startBlock: number | null;
    confirmations: number;
    intervalMs: number;
    overlapBlocks: number;
    lagAlertBlocks: number;
    maxRangeBlocks: number;
    syncLoop: boolean;
  };
  public: PublicEnv;
  production: boolean;
  publicLaunchEnabled: boolean;
  publicChainConfigured: boolean;
  statusPageEnabled: boolean;
  graduationTargetUsdDisplay: number | null;
  invalid: readonly string[];
};

function read(name: string, env: NodeJS.Dict<string> = process.env): string | null {
  const v = env[name]?.trim();
  return v ? v : null;
}

function first(env: NodeJS.Dict<string>, ...names: string[]): string | null {
  for (const name of names) {
    const v = read(name, env);
    if (v) return v;
  }
  return null;
}

function readInt(name: string, env: NodeJS.Dict<string> = process.env): number | null {
  const v = read(name, env);
  if (!v) return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

function firstInt(env: NodeJS.Dict<string>, ...names: string[]): number | null {
  for (const name of names) {
    const raw = read(name, env);
    if (!raw) continue;
    const n = Number(raw);
    if (Number.isInteger(n)) return n;
  }
  return null;
}

function readWeight(name: string, fallback: number, env: NodeJS.Dict<string>): number {
  const n = Number(env[name] ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

function isAddress(value: string | null): boolean {
  return Boolean(value && ADDRESS_RE.test(value));
}

function rejectOrKeep(
  value: string | null,
  reject: boolean,
  key: string,
  invalid: string[],
): string | null {
  if (!value) return null;
  if (reject) {
    invalid.push(key);
    return null;
  }
  return value;
}

function collectInvalid(env: NodeJS.Dict<string>): string[] {
  const invalid: string[] = [];
  const maybeAddress = [
    "LAUNCH_FACTORY_ADDRESS",
    "FUSED_FACTORY_ADDRESS",
    "LAUNCH_LOCKER_ADDRESS",
    "UNISWAP_POOL_MANAGER_ADDRESS",
    "UNISWAP_POOL_MANAGER",
    "UNISWAP_POSITION_MANAGER_ADDRESS",
    "UNISWAP_POSITION_MANAGER",
    "UNISWAP_UNIVERSAL_ROUTER_ADDRESS",
    "UNISWAP_UNIVERSAL_ROUTER",
    "UNISWAP_PERMIT2_ADDRESS",
    "UNISWAP_PERMIT2",
    "UNISWAP_STATE_VIEW",
    "UNISWAP_QUOTER",
    "UNISWAP_V3_FACTORY",
    "UNISWAP_V2_FACTORY",
  ];
  for (const key of maybeAddress) {
    const v = read(key, env);
    if (v && !isAddress(v)) invalid.push(key);
  }
  for (const key of ["CHAIN_ID", "NEXT_PUBLIC_CHAIN_ID", "LAUNCH_DEPLOY_BLOCK", "INDEXER_START_BLOCK"]) {
    const v = read(key, env);
    if (v && !Number.isInteger(Number(v))) invalid.push(key);
  }
  const urlKeys = ["DATABASE_URL", "RPC_URL", "NEXT_PUBLIC_RPC_URL", "NEXT_PUBLIC_APP_URL", "FUSED_SITE_URL"];
  for (const key of urlKeys) {
    const v = read(key, env);
    if (!v) continue;
    try {
      new URL(v);
    } catch {
      invalid.push(key);
    }
  }
  return invalid;
}

export function fieldState(value: string | number | null, invalid = false): ConfigState {
  if (invalid) return "invalid";
  if (value === null || value === "") return "not_configured";
  return "configured";
}

export function loadEnv(env: NodeJS.Dict<string> = process.env): FusedEnv {
  const source = env === process.env ? mergeLocalDeployment(env) : env;
  const production = isProductionEnv(source);
  const invalid = collectInvalid(source);
  const chainId = firstInt(source, "CHAIN_ID", "NEXT_PUBLIC_CHAIN_ID");
  const publicEnv = loadPublicEnv(source);

  const databaseUrl = rejectOrKeep(
    read("DATABASE_URL", source),
    shouldRejectLocalhostUrl(read("DATABASE_URL", source), source),
    "DATABASE_URL",
    invalid,
  );
  const rpcUrl = rejectOrKeep(
    read("RPC_URL", source),
    shouldRejectLocalhostUrl(read("RPC_URL", source), source),
    "RPC_URL",
    invalid,
  );
  const rpcUrlFallback = rejectOrKeep(
    read("RPC_URL_FALLBACK", source),
    shouldRejectLocalhostUrl(read("RPC_URL_FALLBACK", source), source),
    "RPC_URL_FALLBACK",
    invalid,
  );

  const launchFactory = rejectOrKeep(
    first(source, "LAUNCH_FACTORY_ADDRESS", "FUSED_FACTORY_ADDRESS"),
    shouldRejectAnvilAddress(first(source, "LAUNCH_FACTORY_ADDRESS", "FUSED_FACTORY_ADDRESS"), chainId, source),
    "LAUNCH_FACTORY_ADDRESS",
    invalid,
  );
  const launchLocker = rejectOrKeep(
    first(source, "LAUNCH_LOCKER_ADDRESS", "FUSED_LOCKER_ADDRESS"),
    shouldRejectAnvilAddress(first(source, "LAUNCH_LOCKER_ADDRESS", "FUSED_LOCKER_ADDRESS"), chainId, source),
    "LAUNCH_LOCKER_ADDRESS",
    invalid,
  );

  const poolManagerRaw = first(source, "UNISWAP_POOL_MANAGER_ADDRESS", "UNISWAP_POOL_MANAGER");
  const positionManagerRaw = first(source, "UNISWAP_POSITION_MANAGER_ADDRESS", "UNISWAP_POSITION_MANAGER");
  const poolManager = rejectOrKeep(
    poolManagerRaw,
    shouldRejectAnvilAddress(poolManagerRaw, chainId, source),
    "UNISWAP_POOL_MANAGER_ADDRESS",
    invalid,
  );
  const positionManager = rejectOrKeep(
    positionManagerRaw,
    shouldRejectAnvilAddress(positionManagerRaw, chainId, source),
    "UNISWAP_POSITION_MANAGER_ADDRESS",
    invalid,
  );

  const mediaStoreRaw = first(source, "MEDIA_STORE", "IMAGE_STORE");
  const mediaStore = mediaStoreRaw ?? (production ? null : "local");
  if (production && (mediaStore ?? "local").toLowerCase() === "local") {
    invalid.push("MEDIA_STORE");
  }
  const mediaPublicBase = rejectOrKeep(
    first(source, "IMAGE_PUBLIC_BASE", "MEDIA_PUBLIC_BASE"),
    shouldRejectLocalhostUrl(first(source, "IMAGE_PUBLIC_BASE", "MEDIA_PUBLIC_BASE"), source),
    "IMAGE_PUBLIC_BASE",
    invalid,
  );

  let siteUrl = first(source, "NEXT_PUBLIC_APP_URL", "FUSED_SITE_URL");
  if (shouldRejectLocalhostUrl(siteUrl, source)) {
    invalid.push("NEXT_PUBLIC_APP_URL");
    siteUrl = null;
  }
  if (!siteUrl) siteUrl = production ? "" : "http://localhost:3000";

  const startBlock = firstInt(source, "INDEXER_START_BLOCK", "LAUNCH_DEPLOY_BLOCK");
  const contractsOk =
    Boolean(launchFactory) &&
    Boolean(launchLocker) &&
    !invalid.includes("LAUNCH_FACTORY_ADDRESS") &&
    !invalid.includes("LAUNCH_LOCKER_ADDRESS");

  const publicLaunchEnabled = isPublicLaunchEnabled(
    {
      chainId,
      publicChainId: publicEnv.chainId,
      publicRpcUrl: publicEnv.rpcUrl,
      contractsOk,
    },
    source,
  );
  const publicChainConfigured = isPublicChainConfigured(
    {
      chainId,
      publicChainId: publicEnv.chainId,
      publicRpcUrl: publicEnv.rpcUrl,
      contractsOk,
    },
    source,
  );

  return {
    siteUrl,
    databaseUrl,
    chainId,
    rpcUrl,
    rpcUrlFallback,
    launchFactory,
    launchLocker,
    launchDeployBlock: startBlock,
    uniswap: {
      poolManager,
      positionManager,
      stateView: read("UNISWAP_STATE_VIEW", source),
      quoter: read("UNISWAP_QUOTER", source),
      universalRouter: first(source, "UNISWAP_UNIVERSAL_ROUTER_ADDRESS", "UNISWAP_UNIVERSAL_ROUTER"),
      permit2: first(source, "UNISWAP_PERMIT2_ADDRESS", "UNISWAP_PERMIT2"),
      v3Factory: read("UNISWAP_V3_FACTORY", source),
      v2Factory: read("UNISWAP_V2_FACTORY", source),
    },
    social: {
      provider: read("SOCIAL_PROVIDER", source),
      bearerToken: first(source, "X_BEARER_TOKEN", "X_APP_ONLY_TOKEN"),
      apiKey: read("X_API_KEY", source),
      apiSecret: read("X_API_SECRET", source),
      trackedAccountsPath: read("TRACKED_ACCOUNTS_PATH", source) || "config/tracked-accounts.json",
      lastSync: null,
      weights: {
        velocity: readWeight("TRENDING_VELOCITY_WEIGHT", 0.45, source),
        recency: readWeight("TRENDING_RECENCY_WEIGHT", 0.25, source),
        totals: readWeight("TRENDING_TOTALS_WEIGHT", 0.3, source),
        priority: readWeight("TRENDING_PRIORITY_WEIGHT", 0.1, source),
      },
    },
    media: {
      store: production && (mediaStore ?? "local").toLowerCase() === "local" ? null : mediaStore,
      localPath: production ? null : read("MEDIA_LOCAL_PATH", source),
      publicBase: mediaPublicBase,
      awsAccessKeyId: read("AWS_ACCESS_KEY_ID", source),
      awsSecretAccessKey: read("AWS_SECRET_ACCESS_KEY", source),
      awsEndpoint: read("AWS_ENDPOINT_URL_S3", source),
      awsRegion: read("AWS_REGION", source),
      bucket: read("BUCKET_NAME", source),
    },
    aiImageProvider: read("AI_IMAGE_PROVIDER", source),
    aiImage: {
      provider: read("AI_IMAGE_PROVIDER", source),
      apiKey: first(source, "AI_IMAGE_API_KEY", "AI_API_KEY"),
      apiBaseUrl: first(source, "AI_IMAGE_API_BASE_URL", "AI_API_BASE_URL"),
      model: first(source, "AI_IMAGE_MODEL"),
    },
    ai: {
      provider: read("AI_PROVIDER", source),
      apiKey: read("AI_API_KEY", source),
      apiBaseUrl: read("AI_API_BASE_URL", source),
      model: read("AI_MODEL", source),
      maxOutputTokens: readInt("AI_MAX_OUTPUT_TOKENS", source) ?? 1200,
      timeoutMs: readInt("AI_TIMEOUT_MS", source) ?? 30_000,
    },
    tokenizedAssetRegistryPath: read("TOKENIZED_ASSET_REGISTRY_PATH", source),
    imageStore: production && (mediaStore ?? "local").toLowerCase() === "local" ? null : mediaStore,
    indexer: {
      startBlock: startBlock,
      confirmations: readInt("INDEXER_CONFIRMATIONS", source) ?? 2,
      intervalMs: firstInt(source, "INDEXER_POLL_INTERVAL", "INDEXER_INTERVAL_MS") ?? 15_000,
      overlapBlocks: readInt("INDEXER_OVERLAP_BLOCKS", source) ?? 50,
      lagAlertBlocks: readInt("INDEXER_LAG_ALERT_BLOCKS", source) ?? 200,
      maxRangeBlocks: Math.max(1, readInt("INDEXER_MAX_RANGE_BLOCKS", source) ?? 2_000),
      syncLoop: read("INDEXER_SYNC_LOOP", source) === "1",
    },
    public: publicEnv,
    production,
    publicLaunchEnabled,
    publicChainConfigured,
    statusPageEnabled: isStatusPageEnabled(source),
    graduationTargetUsdDisplay: firstInt(source, "NEXT_PUBLIC_GRADUATION_TARGET_USD"),
    invalid: [...new Set(invalid)],
  };
}

export function databaseAvailability(cfg: FusedEnv): Availability {
  if (!cfg.databaseUrl) return notConfigured(["DATABASE_URL"]);
  if (cfg.invalid.includes("DATABASE_URL")) {
    return { status: AVAILABILITY_STATUS.NOT_CONFIGURED, reason: "DATABASE_URL is invalid.", missing: ["DATABASE_URL"] };
  }
  return { status: AVAILABILITY_STATUS.OK };
}

export function rpcAvailability(cfg: FusedEnv): Availability {
  if (!cfg.rpcUrl || !cfg.chainId) return notConfigured(["RPC_URL", "CHAIN_ID"]);
  if (cfg.invalid.includes("RPC_URL")) {
    return { status: AVAILABILITY_STATUS.NOT_CONFIGURED, reason: "RPC_URL is invalid.", missing: ["RPC_URL"] };
  }
  return { status: AVAILABILITY_STATUS.OK };
}

export function socialAvailability(cfg: FusedEnv): Availability {
  const missing: string[] = [];
  if (!cfg.social.provider) missing.push("SOCIAL_PROVIDER");
  if (!cfg.social.bearerToken) missing.push("X_BEARER_TOKEN");
  if (missing.length) return notConfigured(missing);
  return { status: AVAILABILITY_STATUS.OK };
}

export function trackedAccountsAvailability(cfg: FusedEnv): Availability {
  if (!cfg.social.trackedAccountsPath) return notConfigured(["TRACKED_ACCOUNTS_PATH"]);
  return { status: AVAILABILITY_STATUS.OK };
}

export function mediaAvailability(cfg: FusedEnv): Availability {
  const store = (cfg.media.store || "").toLowerCase();
  if (store === "s3" || store === "r2") {
    const missing: string[] = [];
    if (!cfg.media.awsAccessKeyId) missing.push("AWS_ACCESS_KEY_ID");
    if (!cfg.media.awsSecretAccessKey) missing.push("AWS_SECRET_ACCESS_KEY");
    if (!cfg.media.bucket) missing.push("BUCKET_NAME");
    if (!cfg.media.publicBase) missing.push("IMAGE_PUBLIC_BASE");
    if (missing.length) return notConfigured(missing, "Object storage is not configured.");
    return { status: AVAILABILITY_STATUS.OK };
  }
  if (cfg.production || store === "") {
    return notConfigured(["MEDIA_STORE"], "Local filesystem media is not allowed in production. Configure S3/R2.");
  }
  if (store === "local") return { status: AVAILABILITY_STATUS.OK };
  return notConfigured(["MEDIA_STORE"], "Media store is not configured.");
}

export function walletConnectAvailability(cfg: FusedEnv): Availability {
  if (!cfg.public.walletConnectProjectId) return notConfigured(["NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID"]);
  return { status: AVAILABILITY_STATUS.OK };
}

export function aiImageAvailability(cfg: FusedEnv): Availability {
  const missing: string[] = [];
  if (!cfg.aiImage.provider) missing.push("AI_IMAGE_PROVIDER");
  if (!cfg.aiImage.apiKey) missing.push("AI_IMAGE_API_KEY");
  if (missing.length) return notConfigured(missing, "AI image generation is not available.");
  return { status: AVAILABILITY_STATUS.OK };
}

export function localChainAvailability(cfg: FusedEnv): Availability {
  if (cfg.production) {
    return notConfigured(["CHAIN_ID"], "Local Anvil is not used in production.");
  }
  if (cfg.chainId === 31337 && cfg.rpcUrl) return { status: AVAILABILITY_STATUS.OK };
  if (!cfg.chainId || !cfg.rpcUrl) return notConfigured(["CHAIN_ID", "RPC_URL"], "Local chain is not configured.");
  return { status: AVAILABILITY_STATUS.OK };
}

export function aiAvailability(cfg: FusedEnv): Availability {
  const missing: string[] = [];
  if (!cfg.ai.provider) missing.push("AI_PROVIDER");
  if (!cfg.ai.apiKey) missing.push("AI_API_KEY");
  if (!cfg.ai.model) missing.push("AI_MODEL");
  if (missing.length) return notConfigured(missing);
  return { status: AVAILABILITY_STATUS.OK };
}

export function launchContractsAvailability(cfg: FusedEnv): Availability {
  const factoryOk = Boolean(cfg.launchFactory) && !cfg.invalid.includes("LAUNCH_FACTORY_ADDRESS");
  const lockerOk = Boolean(cfg.launchLocker) && !cfg.invalid.includes("LAUNCH_LOCKER_ADDRESS");
  const missing: string[] = [];
  if (!factoryOk) missing.push("LAUNCH_FACTORY_ADDRESS");
  if (!lockerOk) missing.push("LAUNCH_LOCKER_ADDRESS");
  if (missing.length) {
    return {
      status: AVAILABILITY_STATUS.CONTRACTS_NOT_DEPLOYED,
      missing,
      reason:
        "Fused AI launch contracts are not configured. Upstream OpenLaunch addresses must not be used as production defaults.",
    };
  }
  return { status: AVAILABILITY_STATUS.OK };
}

export function indexerAvailability(cfg: FusedEnv): Availability {
  const missing: string[] = [];
  if (!cfg.databaseUrl) missing.push("DATABASE_URL");
  if (!cfg.rpcUrl) missing.push("RPC_URL");
  if (!cfg.chainId) missing.push("CHAIN_ID");
  if (!cfg.launchFactory) missing.push("LAUNCH_FACTORY_ADDRESS");
  if (missing.length) {
    return notConfigured(missing, "Launch indexer is not configured.");
  }
  return { status: AVAILABILITY_STATUS.OK };
}

export function tokenizedAssetRegistryAvailability(cfg: FusedEnv): Availability {
  if (!cfg.tokenizedAssetRegistryPath) {
    return notConfigured(["TOKENIZED_ASSET_REGISTRY_PATH"], "No verified tokenized-asset registry path is set.");
  }
  return { status: AVAILABILITY_STATUS.OK };
}

export function walletAvailability(cfg: FusedEnv): Availability {
  return publicWalletAvailability(cfg.public);
}

export function systemStatus(cfg: FusedEnv = loadEnv()) {
  return {
    database: databaseAvailability(cfg),
    rpc: rpcAvailability(cfg),
    social: socialAvailability(cfg),
    trackedAccounts: trackedAccountsAvailability(cfg),
    media: mediaAvailability(cfg),
    walletConnect: walletConnectAvailability(cfg),
    localChain: localChainAvailability(cfg),
    ai: aiAvailability(cfg),
    aiImage: aiImageAvailability(cfg),
    launchContracts: launchContractsAvailability(cfg),
    indexer: indexerAvailability(cfg),
    tokenizedAssetRegistry: tokenizedAssetRegistryAvailability(cfg),
    wallet: walletAvailability(cfg),
    publicLaunchEnabled: cfg.publicLaunchEnabled,
    publicChainConfigured: cfg.publicChainConfigured,
    invalid: cfg.invalid,
  };
}

export { loadPublicEnv, publicWalletAvailability };
