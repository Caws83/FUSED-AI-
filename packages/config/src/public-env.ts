import { AVAILABILITY_STATUS, notConfigured, type Availability } from "@fused-ai/types";
import { isProductionEnv, shouldRejectLocalhostUrl } from "./production-safety.ts";
import {
  ARC_MAINNET,
  ARC_MAINNET_CHAIN_ID,
  ARC_TESTNET,
  ARC_TESTNET_CHAIN_ID,
  ROBINHOOD_MAINNET,
  ROBINHOOD_MAINNET_CHAIN_ID,
  ROBINHOOD_TESTNET,
  ROBINHOOD_TESTNET_CHAIN_ID,
} from "./networks.ts";

/**
 * Browser-safe env. Only NEXT_PUBLIC_* keys. Never read AI, X, database, or
 * server RPC secrets here — those must not ship in the client bundle.
 */
export type PublicEnv = {
  appUrl: string;
  chainId: number | null;
  rpcUrl: string | null;
  walletConnectProjectId: string | null;
  graduationTargetUsdDisplay: number | null;
};

function read(name: string, env: NodeJS.Dict<string>): string | null {
  const v = env[name]?.trim();
  return v ? v : null;
}

function readInt(name: string, env: NodeJS.Dict<string>): number | null {
  const v = read(name, env);
  if (!v) return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

export function loadPublicEnv(env: NodeJS.Dict<string> = process.env): PublicEnv {
  const production = isProductionEnv(env);
  let appUrl = read("NEXT_PUBLIC_APP_URL", env);
  if (shouldRejectLocalhostUrl(appUrl, env)) appUrl = null;
  if (!appUrl) appUrl = production ? "" : "http://localhost:3000";

  const chainId = readInt("NEXT_PUBLIC_CHAIN_ID", env);
  let rpcUrl = read("NEXT_PUBLIC_RPC_URL", env);
  if (shouldRejectLocalhostUrl(rpcUrl, env)) rpcUrl = null;
  if (!rpcUrl && chainId === ROBINHOOD_MAINNET_CHAIN_ID) rpcUrl = ROBINHOOD_MAINNET.rpcUrl;
  if (!rpcUrl && chainId === ROBINHOOD_TESTNET_CHAIN_ID) rpcUrl = ROBINHOOD_TESTNET.rpcUrl;
  if (!rpcUrl && chainId === ARC_TESTNET_CHAIN_ID) rpcUrl = ARC_TESTNET.rpcUrl;
  if (!rpcUrl && chainId === ARC_MAINNET_CHAIN_ID) rpcUrl = ARC_MAINNET.rpcUrl;

  if (production && chainId === 31337) {
    return {
      appUrl,
      chainId: null,
      rpcUrl: null,
      walletConnectProjectId: read("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID", env),
      graduationTargetUsdDisplay: readInt("NEXT_PUBLIC_GRADUATION_TARGET_USD", env),
    };
  }

  return {
    appUrl,
    chainId,
    rpcUrl,
    walletConnectProjectId: read("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID", env),
    graduationTargetUsdDisplay: readInt("NEXT_PUBLIC_GRADUATION_TARGET_USD", env),
  };
}

export { isStatusPageEnabled } from "./features.ts";
export {
  chainLabelFor,
  explorerBaseFor,
  isWalletSelectorChain,
  launchContractsForChain,
  nativeCurrencyFor,
  newLaunchForWallet,
  parseSupportedChainId,
  rpcUrlForChain,
  INDEXED_BOARD_CHAIN_IDS,
  ARC_MAINNET,
  ARC_TESTNET,
  LOCAL_CHAIN_ID,
  ARC_MAINNET_CHAIN_ID,
  ARC_TESTNET_CHAIN_ID,
  ROBINHOOD_MAINNET,
  ROBINHOOD_MAINNET_CHAIN_ID,
  ROBINHOOD_TESTNET,
  ROBINHOOD_TESTNET_CHAIN_ID,
  WALLET_SELECTOR_CHAIN_IDS,
  type ChainLaunchContracts,
  type WalletLaunchContracts,
} from "./networks.ts";

export function publicWalletAvailability(pub: PublicEnv): Availability {
  const missing: string[] = [];
  if (!pub.chainId) missing.push("NEXT_PUBLIC_CHAIN_ID");
  if (!pub.rpcUrl) missing.push("NEXT_PUBLIC_RPC_URL");
  if (missing.length) {
    return notConfigured(missing, "Browser wallet is not configured.");
  }
  return { status: AVAILABILITY_STATUS.OK };
}
