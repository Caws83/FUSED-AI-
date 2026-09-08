import {
  AVAILABILITY_STATUS,
  notConfigured,
  type Availability,
  type TrendingWeights,
} from "@fused-ai/types";
import { loadPublicEnv, publicWalletAvailability, type PublicEnv } from "./public-env.ts";

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
  indexer: {
    startBlock: number | null;
    confirmations: number;
    intervalMs: number;
    overlapBlocks: number;
    lagAlertBlocks: number;
    syncLoop: boolean;
  };
  public: PublicEnv;
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

function collectInvalid(env: NodeJS.Dict<string>): string[] {
  const invalid: string[] = [];
  const maybeAddress = [
    "LAUNCH_FACTORY_ADDRESS",
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
  const publicEnv = loadPublicEnv(env);
  const startBlock = firstInt(env, "INDEXER_START_BLOCK", "LAUNCH_DEPLOY_BLOCK");
  return {
    siteUrl: first(env, "NEXT_PUBLIC_APP_URL", "FUSED_SITE_URL") ?? "http://localhost:3000",
    databaseUrl: read("DATABASE_URL", env),
    chainId: firstInt(env, "CHAIN_ID", "NEXT_PUBLIC_CHAIN_ID"),
    rpcUrl: read("RPC_URL", env),
    rpcUrlFallback: read("RPC_URL_FALLBACK", env),
    launchFactory: first(env, "LAUNCH_FACTORY_ADDRESS"),
    launchLocker: first(env, "LAUNCH_LOCKER_ADDRESS"),
    launchDeployBlock: startBlock,
    uniswap: {
      poolManager: first(env, "UNISWAP_POOL_MANAGER_ADDRESS", "UNISWAP_POOL_MANAGER"),
      positionManager: first(env, "UNISWAP_POSITION_MANAGER_ADDRESS", "UNISWAP_POSITION_MANAGER"),
      stateView: read("UNISWAP_STATE_VIEW", env),
      quoter: read("UNISWAP_QUOTER", env),
      universalRouter: first(env, "UNISWAP_UNIVERSAL_ROUTER_ADDRESS", "UNISWAP_UNIVERSAL_ROUTER"),
      permit2: first(env, "UNISWAP_PERMIT2_ADDRESS", "UNISWAP_PERMIT2"),
      v3Factory: read("UNISWAP_V3_FACTORY", env),
      v2Factory: read("UNISWAP_V2_FACTORY", env),
    },
    social: {
      provider: read("SOCIAL_PROVIDER", env),
      bearerToken: first(env, "X_BEARER_TOKEN", "X_APP_ONLY_TOKEN"),
      apiKey: read("X_API_KEY", env),
      apiSecret: read("X_API_SECRET", env),
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
    indexer: {
      startBlock: startBlock,
      confirmations: readInt("INDEXER_CONFIRMATIONS", env) ?? 2,
      intervalMs: firstInt(env, "INDEXER_POLL_INTERVAL", "INDEXER_INTERVAL_MS") ?? 15_000,
      overlapBlocks: readInt("INDEXER_OVERLAP_BLOCKS", env) ?? 50,
      lagAlertBlocks: readInt("INDEXER_LAG_ALERT_BLOCKS", env) ?? 200,
      syncLoop: read("INDEXER_SYNC_LOOP", env) === "1",
    },
    public: publicEnv,
    invalid: collectInvalid(env),
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
    ai: aiAvailability(cfg),
    launchContracts: launchContractsAvailability(cfg),
    indexer: indexerAvailability(cfg),
    tokenizedAssetRegistry: tokenizedAssetRegistryAvailability(cfg),
    wallet: walletAvailability(cfg),
    invalid: cfg.invalid,
  };
}

export { loadPublicEnv, publicWalletAvailability };
