import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { findRepoRoot } from "./load-repo-env.ts";
import { isProductionEnv, LOCAL_CHAIN_ID } from "./production-safety.ts";

export type DeploymentStatus = "DEPLOYED" | "NOT_DEPLOYED";

export type DeploymentManifest = {
  network: string;
  chainId: number;
  status: DeploymentStatus;
  rpcUrl?: string | null;
  contracts: {
    launchFactory: string | null;
    launchLocker: string | null;
    poolManager: string | null;
    positionManager: string | null;
    universalRouter?: string | null;
    permit2: string | null;
  };
  curve?: {
    virtualQuoteWei?: string | null;
    virtualToken?: string | null;
    graduationTargetWei?: string | null;
    feeBps?: number | null;
    lpFee?: number | null;
  };
  deployBlock?: number | null;
};

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

function asAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return ADDRESS_RE.test(v) ? v : null;
}

export function parseDeploymentManifest(raw: unknown): DeploymentManifest | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const chainId = Number(row.chainId);
  if (!Number.isInteger(chainId)) return null;
  const status = row.status === "DEPLOYED" ? "DEPLOYED" : "NOT_DEPLOYED";
  const contracts = (row.contracts ?? {}) as Record<string, unknown>;
  return {
    network: typeof row.network === "string" ? row.network : chainId === LOCAL_CHAIN_ID ? "local" : "unknown",
    chainId,
    status,
    rpcUrl: typeof row.rpcUrl === "string" ? row.rpcUrl : null,
    contracts: {
      launchFactory: asAddress(contracts.launchFactory),
      launchLocker: asAddress(contracts.launchLocker),
      poolManager: asAddress(contracts.poolManager),
      positionManager: asAddress(contracts.positionManager),
      universalRouter: asAddress(contracts.universalRouter),
      permit2: asAddress(contracts.permit2),
    },
    curve: row.curve && typeof row.curve === "object" ? (row.curve as DeploymentManifest["curve"]) : undefined,
    deployBlock: Number.isInteger(Number(row.deployBlock)) ? Number(row.deployBlock) : null,
  };
}

function readJsonFile(filePath: string): unknown | null {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  } catch {
    return null;
  }
}

export function localDeploymentPath(root = findRepoRoot()): string {
  return path.join(root, "deployments", `local-${LOCAL_CHAIN_ID}.json`);
}

export function publicDeploymentPath(chainId: number, root = findRepoRoot()): string {
  if (chainId === 4663) return path.join(root, "deployments", "robinhood-4663.json");
  return path.join(root, "deployments", `chain-${chainId}.json`);
}

/** Gitignored local Anvil manifest written by `npm run contracts:deploy:local`. */
export function readLocalDeploymentManifest(root = findRepoRoot()): DeploymentManifest | null {
  const parsed = parseDeploymentManifest(readJsonFile(localDeploymentPath(root)));
  if (!parsed) return null;
  if (parsed.chainId !== LOCAL_CHAIN_ID) return null;
  return { ...parsed, network: "local", status: parsed.contracts.launchFactory ? "DEPLOYED" : "NOT_DEPLOYED" };
}

/**
 * Public/Robinhood manifest. Missing file or example-only checkout → NOT_DEPLOYED.
 * Never invents addresses. Never reads local-31337.json for a public chain.
 */
export function readPublicDeploymentManifest(chainId: number, root = findRepoRoot()): DeploymentManifest {
  if (chainId === LOCAL_CHAIN_ID) {
    return {
      network: "local",
      chainId,
      status: "NOT_DEPLOYED",
      contracts: {
        launchFactory: null,
        launchLocker: null,
        poolManager: null,
        positionManager: null,
        permit2: null,
      },
    };
  }
  const parsed = parseDeploymentManifest(readJsonFile(publicDeploymentPath(chainId, root)));
  if (!parsed || parsed.chainId !== chainId) {
    return {
      network: chainId === 4663 ? "robinhood" : `chain-${chainId}`,
      chainId,
      status: "NOT_DEPLOYED",
      contracts: {
        launchFactory: null,
        launchLocker: null,
        poolManager: null,
        positionManager: null,
        permit2: null,
      },
    };
  }
  const deployed = Boolean(parsed.contracts.launchFactory && parsed.contracts.launchLocker && parsed.status === "DEPLOYED");
  return { ...parsed, status: deployed ? "DEPLOYED" : "NOT_DEPLOYED" };
}

/**
 * Overlay local-31337.json contract addresses onto env for Anvil only.
 * Production / Vercel never reads this file. Explicit test dicts (`loadEnv({})`) skip disk.
 */
export function mergeLocalDeployment(env: NodeJS.Dict<string>, root = findRepoRoot()): NodeJS.Dict<string> {
  if (isProductionEnv(env)) return env;
  const chainRaw = env.CHAIN_ID ?? env.NEXT_PUBLIC_CHAIN_ID;
  const chainId = chainRaw ? Number(chainRaw) : LOCAL_CHAIN_ID;
  if (chainId !== LOCAL_CHAIN_ID) return env;
  const manifest = readLocalDeploymentManifest(root);
  if (!manifest || manifest.status !== "DEPLOYED") return env;
  const c = manifest.contracts;
  const overlay: Record<string, string> = { ...env } as Record<string, string>;
  if (c.launchFactory) overlay.LAUNCH_FACTORY_ADDRESS = c.launchFactory;
  if (c.launchLocker) overlay.LAUNCH_LOCKER_ADDRESS = c.launchLocker;
  if (c.poolManager) overlay.UNISWAP_POOL_MANAGER_ADDRESS = c.poolManager;
  if (c.positionManager) overlay.UNISWAP_POSITION_MANAGER_ADDRESS = c.positionManager;
  if (c.permit2) overlay.UNISWAP_PERMIT2_ADDRESS = c.permit2;
  if (manifest.deployBlock != null) {
    overlay.LAUNCH_DEPLOY_BLOCK = String(manifest.deployBlock);
    overlay.INDEXER_START_BLOCK = overlay.INDEXER_START_BLOCK || String(manifest.deployBlock);
  }
  const curve = manifest.curve;
  if (curve?.virtualQuoteWei) overlay.FUSED_VIRTUAL_QUOTE_WEI = curve.virtualQuoteWei;
  if (curve?.virtualToken) overlay.FUSED_VIRTUAL_TOKEN = curve.virtualToken;
  if (curve?.graduationTargetWei) overlay.FUSED_GRADUATION_TARGET_WEI = curve.graduationTargetWei;
  if (curve?.feeBps != null) overlay.FUSED_FEE_BPS = String(curve.feeBps);
  if (curve?.lpFee != null) overlay.FUSED_LP_FEE = String(curve.lpFee);
  return overlay;
}
