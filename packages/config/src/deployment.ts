import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findRepoRoot } from "./load-repo-env.ts";
import { isProductionEnv, LOCAL_CHAIN_ID } from "./production-safety.ts";
import {
  ROBINHOOD_MAINNET_CHAIN_ID,
  ROBINHOOD_TESTNET_CHAIN_ID,
  deploymentFileName,
  v2DeploymentFileName,
} from "./networks.ts";

function repoRootFromConfigPackage(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
}

export type DeploymentStatus = "DEPLOYED" | "NOT_DEPLOYED";

export type DeploymentManifest = {
  network: string;
  chainId: number;
  status: DeploymentStatus;
  rpcUrl?: string | null;
  explorer?: string | null;
  deployer?: string | null;
  transactions?: { factory?: string | null };
  contracts: {
    launchFactory: string | null;
    launchLocker: string | null;
    poolManager: string | null;
    positionManager: string | null;
    universalRouter?: string | null;
    permit2: string | null;
    stateView?: string | null;
    quoter?: string | null;
  };
  curve?: {
    virtualQuoteWei?: string | null;
    virtualToken?: string | null;
    graduationTargetWei?: string | null;
    feeBps?: number | null;
    lpFee?: number | null;
    note?: string | null;
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
  const network =
    typeof row.network === "string"
      ? row.network
      : chainId === LOCAL_CHAIN_ID
        ? "local"
        : chainId === ROBINHOOD_TESTNET_CHAIN_ID
          ? "robinhood-testnet"
          : chainId === ROBINHOOD_MAINNET_CHAIN_ID
            ? "robinhood"
            : "unknown";
  return {
    network,
    chainId,
    status,
    rpcUrl: typeof row.rpcUrl === "string" ? row.rpcUrl : null,
    explorer: typeof row.explorer === "string" ? row.explorer : null,
    deployer: asAddress(row.deployer),
    contracts: {
      launchFactory: asAddress(contracts.launchFactory),
      launchLocker: asAddress(contracts.launchLocker),
      poolManager: asAddress(contracts.poolManager),
      positionManager: asAddress(contracts.positionManager),
      universalRouter: asAddress(contracts.universalRouter),
      permit2: asAddress(contracts.permit2),
      stateView: asAddress(contracts.stateView),
      quoter: asAddress(contracts.quoter),
    },
    curve: row.curve && typeof row.curve === "object" ? (row.curve as DeploymentManifest["curve"]) : undefined,
    deployBlock:
      row.deployBlock == null || row.deployBlock === ""
        ? null
        : Number.isInteger(Number(row.deployBlock))
          ? Number(row.deployBlock)
          : null,
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

function resolveRepoRoot(root?: string): string {
  if (root) return root;
  const fromWalk = findRepoRoot();
  if (existsSync(path.join(fromWalk, "deployments")) || existsSync(path.join(fromWalk, ".env.example"))) {
    return fromWalk;
  }
  return repoRootFromConfigPackage();
}

export function localDeploymentPath(root = resolveRepoRoot()): string {
  return path.join(root, "deployments", deploymentFileName(LOCAL_CHAIN_ID));
}

export function publicDeploymentPath(chainId: number, root = resolveRepoRoot()): string {
  return path.join(root, "deployments", deploymentFileName(chainId));
}

export function publicDeploymentExamplePath(chainId: number, root = resolveRepoRoot()): string {
  const file = deploymentFileName(chainId);
  return path.join(root, "deployments", file.replace(/\.json$/, ".example.json"));
}

export function publicV2DeploymentPath(chainId: number, root = resolveRepoRoot()): string | null {
  const file = v2DeploymentFileName(chainId);
  if (!file) return null;
  return path.join(root, "deployments", file);
}

/** V2 public manifest. Missing file → null. Never invents addresses. Never used for 4663. */
export function readPublicV2DeploymentManifest(chainId: number, root = resolveRepoRoot()): DeploymentManifest | null {
  if (chainId === LOCAL_CHAIN_ID || chainId === ROBINHOOD_MAINNET_CHAIN_ID) return null;
  const filePath = publicV2DeploymentPath(chainId, root);
  if (!filePath) return null;
  const parsed = parseDeploymentManifest(readJsonFile(filePath));
  if (!parsed || parsed.chainId !== chainId) return null;
  const deployed = Boolean(
    parsed.contracts.launchFactory && parsed.contracts.launchLocker && parsed.status === "DEPLOYED",
  );
  return { ...parsed, status: deployed ? "DEPLOYED" : "NOT_DEPLOYED" };
}

/** Gitignored local Anvil manifest written by `npm run contracts:deploy:local`. */
export function readLocalDeploymentManifest(root = resolveRepoRoot()): DeploymentManifest | null {
  const parsed = parseDeploymentManifest(readJsonFile(localDeploymentPath(root)));
  if (!parsed) return null;
  if (parsed.chainId !== LOCAL_CHAIN_ID) return null;
  return { ...parsed, network: "local", status: parsed.contracts.launchFactory ? "DEPLOYED" : "NOT_DEPLOYED" };
}

function emptyManifest(chainId: number): DeploymentManifest {
  const network =
    chainId === ROBINHOOD_TESTNET_CHAIN_ID
      ? "robinhood-testnet"
      : chainId === ROBINHOOD_MAINNET_CHAIN_ID
        ? "robinhood"
        : `chain-${chainId}`;
  return {
    network,
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

/**
 * Public/Robinhood manifest. Missing file → example JSON if present, else NOT_DEPLOYED.
 * Never invents Fused addresses. Never reads local-31337.json for a public chain.
 */
export function readPublicDeploymentManifest(chainId: number, root = resolveRepoRoot()): DeploymentManifest {
  if (chainId === LOCAL_CHAIN_ID) return emptyManifest(chainId);
  const parsed =
    parseDeploymentManifest(readJsonFile(publicDeploymentPath(chainId, root))) ??
    parseDeploymentManifest(readJsonFile(publicDeploymentExamplePath(chainId, root)));
  if (!parsed || parsed.chainId !== chainId) return emptyManifest(chainId);
  const deployed = Boolean(
    parsed.contracts.launchFactory && parsed.contracts.launchLocker && parsed.status === "DEPLOYED",
  );
  return { ...parsed, status: deployed ? "DEPLOYED" : "NOT_DEPLOYED" };
}

function fillIfEmpty(overlay: Record<string, string>, key: string, value: string | null | undefined): void {
  if (!value) return;
  if (!overlay[key]?.trim()) overlay[key] = value;
}

function applyManifest(env: NodeJS.Dict<string>, manifest: DeploymentManifest): NodeJS.Dict<string> {
  const overlay: Record<string, string> = { ...(env as Record<string, string>) };
  const c = manifest.contracts;
  fillIfEmpty(overlay, "RPC_URL", manifest.rpcUrl);
  fillIfEmpty(overlay, "NEXT_PUBLIC_RPC_URL", manifest.rpcUrl);
  fillIfEmpty(overlay, "CHAIN_ID", String(manifest.chainId));
  fillIfEmpty(overlay, "NEXT_PUBLIC_CHAIN_ID", String(manifest.chainId));
  if (manifest.status !== "DEPLOYED") {
    fillIfEmpty(overlay, "UNISWAP_POOL_MANAGER_ADDRESS", c.poolManager);
    fillIfEmpty(overlay, "UNISWAP_POSITION_MANAGER_ADDRESS", c.positionManager);
    fillIfEmpty(overlay, "UNISWAP_PERMIT2_ADDRESS", c.permit2);
    fillIfEmpty(overlay, "UNISWAP_STATE_VIEW", c.stateView);
    fillIfEmpty(overlay, "UNISWAP_QUOTER", c.quoter);
    fillIfEmpty(overlay, "UNISWAP_UNIVERSAL_ROUTER_ADDRESS", c.universalRouter);
    return overlay;
  }
  if (c.poolManager) overlay.UNISWAP_POOL_MANAGER_ADDRESS = c.poolManager;
  if (c.positionManager) overlay.UNISWAP_POSITION_MANAGER_ADDRESS = c.positionManager;
  if (c.permit2) overlay.UNISWAP_PERMIT2_ADDRESS = c.permit2;
  if (c.stateView) overlay.UNISWAP_STATE_VIEW = c.stateView;
  if (c.quoter) overlay.UNISWAP_QUOTER = c.quoter;
  if (c.universalRouter) overlay.UNISWAP_UNIVERSAL_ROUTER_ADDRESS = c.universalRouter;
  if (c.launchFactory) overlay.LAUNCH_FACTORY_ADDRESS = c.launchFactory;
  if (c.launchLocker) overlay.LAUNCH_LOCKER_ADDRESS = c.launchLocker;
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

/**
 * Overlay deployment JSON onto env.
 * Local 31337: gitignored local-31337.json, never in production.
 * Public chains: committed robinhood-testnet-46630.json / robinhood-4663.json when DEPLOYED.
 */
export function mergeLocalDeployment(env: NodeJS.Dict<string>, root = resolveRepoRoot()): NodeJS.Dict<string> {
  return mergeChainDeployment(env, root);
}

function applyTestnetGenerations(env: NodeJS.Dict<string>, root: string): NodeJS.Dict<string> {
  const v1 = readPublicDeploymentManifest(ROBINHOOD_TESTNET_CHAIN_ID, root);
  const overlay = applyManifest(env, v1) as Record<string, string>;
  if (v1.status === "DEPLOYED" && v1.contracts.launchFactory) {
    fillIfEmpty(overlay, "LAUNCH_FACTORY_V1_ADDRESS", v1.contracts.launchFactory);
    fillIfEmpty(overlay, "LAUNCH_LOCKER_V1_ADDRESS", v1.contracts.launchLocker);
    if (v1.deployBlock != null) fillIfEmpty(overlay, "LAUNCH_V1_DEPLOY_BLOCK", String(v1.deployBlock));
  }
  const v2 = readPublicV2DeploymentManifest(ROBINHOOD_TESTNET_CHAIN_ID, root);
  if (v2?.status === "DEPLOYED" && v2.contracts.launchFactory && v2.contracts.launchLocker) {
    fillIfEmpty(overlay, "LAUNCH_FACTORY_V2_ADDRESS", v2.contracts.launchFactory);
    fillIfEmpty(overlay, "LAUNCH_LOCKER_V2_ADDRESS", v2.contracts.launchLocker);
    if (v2.deployBlock != null) fillIfEmpty(overlay, "LAUNCH_V2_DEPLOY_BLOCK", String(v2.deployBlock));
    fillIfEmpty(overlay, "DEFAULT_LAUNCH_VERSION", "v2");
    overlay.LAUNCH_FACTORY_ADDRESS = v2.contracts.launchFactory;
    overlay.LAUNCH_LOCKER_ADDRESS = v2.contracts.launchLocker;
    if (v2.curve?.feeBps != null) overlay.FUSED_FEE_BPS = String(v2.curve.feeBps);
    if (v1.deployBlock != null) {
      overlay.LAUNCH_DEPLOY_BLOCK = String(v1.deployBlock);
      overlay.INDEXER_START_BLOCK = overlay.INDEXER_START_BLOCK || String(v1.deployBlock);
    }
  }
  return overlay;
}

export function mergeChainDeployment(env: NodeJS.Dict<string>, root = resolveRepoRoot()): NodeJS.Dict<string> {
  const chainRaw = env.CHAIN_ID ?? env.NEXT_PUBLIC_CHAIN_ID;
  const chainId = chainRaw ? Number(chainRaw) : LOCAL_CHAIN_ID;
  if (!Number.isInteger(chainId)) return env;
  if (chainId === LOCAL_CHAIN_ID) {
    if (isProductionEnv(env)) return env;
    const manifest = readLocalDeploymentManifest(root);
    if (!manifest) return env;
    return applyManifest(env, manifest);
  }
  if (chainId === ROBINHOOD_TESTNET_CHAIN_ID) {
    return applyTestnetGenerations(env, root);
  }
  return applyManifest(env, readPublicDeploymentManifest(chainId, root));
}

export { ROBINHOOD_TESTNET_CHAIN_ID, ROBINHOOD_MAINNET_CHAIN_ID };
