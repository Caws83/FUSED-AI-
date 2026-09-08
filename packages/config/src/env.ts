import {
  AVAILABILITY_STATUS,
  notConfigured,
  type Availability,
  type TrendingWeights,
} from "@fused-ai/types";

export type FusedEnv = {
  siteUrl: string;
  databaseUrl: string | null;
  chainId: number | null;
  rpcUrl: string | null;
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
    trackedAccountsPath: string | null;
    weights: TrendingWeights;
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
  imageStore: string;
  walletConnectProjectId: string | null;
};

function read(name: string, env: NodeJS.Dict<string> = process.env): string | null {
  const v = env[name]?.trim();
  return v ? v : null;
}

function readInt(name: string, env: NodeJS.Dict<string> = process.env): number | null {
  const v = read(name, env);
  if (!v) return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

function readWeight(name: string, fallback: number, env: NodeJS.Dict<string>): number {
  const n = Number(env[name] ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

export function loadEnv(env: NodeJS.Dict<string> = process.env): FusedEnv {
  return {
    siteUrl: read("FUSED_SITE_URL", env) ?? "http://localhost:3000",
    databaseUrl: read("DATABASE_URL", env),
    chainId: readInt("CHAIN_ID", env),
    rpcUrl: read("RPC_URL", env),
    launchFactory: read("LAUNCH_FACTORY_ADDRESS", env),
    launchLocker: read("LAUNCH_LOCKER_ADDRESS", env),
    launchDeployBlock: readInt("LAUNCH_DEPLOY_BLOCK", env),
    uniswap: {
      poolManager: read("UNISWAP_POOL_MANAGER", env),
      positionManager: read("UNISWAP_POSITION_MANAGER", env),
      stateView: read("UNISWAP_STATE_VIEW", env),
      quoter: read("UNISWAP_QUOTER", env),
      universalRouter: read("UNISWAP_UNIVERSAL_ROUTER", env),
      permit2: read("UNISWAP_PERMIT2", env),
      v3Factory: read("UNISWAP_V3_FACTORY", env),
      v2Factory: read("UNISWAP_V2_FACTORY", env),
    },
    social: {
      provider: read("SOCIAL_PROVIDER", env),
      bearerToken: read("X_BEARER_TOKEN", env) ?? read("X_APP_ONLY_TOKEN", env),
      trackedAccountsPath: read("TRACKED_ACCOUNTS_PATH", env),
      weights: {
        velocity: readWeight("TRENDING_VELOCITY_WEIGHT", 0.45, env),
        recency: readWeight("TRENDING_RECENCY_WEIGHT", 0.25, env),
        totals: readWeight("TRENDING_TOTALS_WEIGHT", 0.3, env),
      },
    },
    ai: {
      provider: read("AI_PROVIDER", env),
      apiKey: read("AI_API_KEY", env),
      apiBaseUrl: read("AI_API_BASE_URL", env),
      model: read("AI_MODEL", env),
      maxOutputTokens: readInt("AI_MAX_OUTPUT_TOKENS", env) ?? 1200,
      timeoutMs: readInt("AI_TIMEOUT_MS", env) ?? 30_000,
    },
    tokenizedAssetRegistryPath: read("TOKENIZED_ASSET_REGISTRY_PATH", env),
    imageStore: read("IMAGE_STORE", env) ?? "local",
    walletConnectProjectId: read("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID", env) ?? read("WALLETCONNECT_PROJECT_ID", env),
  };
}

export function databaseAvailability(cfg: FusedEnv): Availability {
  if (!cfg.databaseUrl) return notConfigured(["DATABASE_URL"]);
  return { status: AVAILABILITY_STATUS.OK };
}

export function rpcAvailability(cfg: FusedEnv): Availability {
  if (!cfg.rpcUrl || !cfg.chainId) return notConfigured(["RPC_URL", "CHAIN_ID"]);
  return { status: AVAILABILITY_STATUS.OK };
}

export function socialAvailability(cfg: FusedEnv): Availability {
  const missing: string[] = [];
  if (!cfg.social.provider) missing.push("SOCIAL_PROVIDER");
  if (!cfg.social.bearerToken) missing.push("X_BEARER_TOKEN");
  if (!cfg.social.trackedAccountsPath) missing.push("TRACKED_ACCOUNTS_PATH");
  if (missing.length) return notConfigured(missing);
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
  const missing: string[] = [];
  if (!cfg.launchFactory) missing.push("LAUNCH_FACTORY_ADDRESS");
  if (!cfg.launchLocker) missing.push("LAUNCH_LOCKER_ADDRESS");
  if (missing.length) {
    return {
      status: AVAILABILITY_STATUS.CONTRACTS_NOT_DEPLOYED,
      missing,
      reason: "Fused AI launch contracts are not configured. Upstream OpenLaunch addresses must not be used as production defaults.",
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
  return {
    status: AVAILABILITY_STATUS.PROVIDER_UNAVAILABLE,
    reason: "Indexer event loop is not implemented. Refusing to list synthetic launches.",
  };
}

export function tokenizedAssetRegistryAvailability(cfg: FusedEnv): Availability {
  if (!cfg.tokenizedAssetRegistryPath) {
    return notConfigured(["TOKENIZED_ASSET_REGISTRY_PATH"], "No verified tokenized-asset registry path is set.");
  }
  return { status: AVAILABILITY_STATUS.OK };
}

export function walletAvailability(cfg: FusedEnv): Availability {
  const missing: string[] = [];
  if (!cfg.chainId) missing.push("CHAIN_ID");
  if (!cfg.rpcUrl) missing.push("RPC_URL");
  if (missing.length) {
    return notConfigured(missing, "Wallet stack is not configured. Connect Wallet stays disabled.");
  }
  return { status: AVAILABILITY_STATUS.OK };
}

export function systemStatus(cfg: FusedEnv = loadEnv()) {
  return {
    database: databaseAvailability(cfg),
    rpc: rpcAvailability(cfg),
    social: socialAvailability(cfg),
    ai: aiAvailability(cfg),
    launchContracts: launchContractsAvailability(cfg),
    indexer: indexerAvailability(cfg),
    tokenizedAssetRegistry: tokenizedAssetRegistryAvailability(cfg),
    wallet: walletAvailability(cfg),
  };
}
