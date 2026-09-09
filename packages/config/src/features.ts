import { isProductionEnv, LOCAL_CHAIN_ID } from "./production-safety.ts";

function flag(value: string | null | undefined): boolean | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes") return true;
  if (v === "0" || v === "false" || v === "no") return false;
  return null;
}

export function readPublicChainConfiguredFlag(env: NodeJS.Dict<string>): boolean | null {
  return flag(env.PUBLIC_CHAIN_CONFIGURED);
}

export function readPublicLaunchEnabledFlag(env: NodeJS.Dict<string>): boolean | null {
  return flag(env.PUBLIC_LAUNCH_ENABLED);
}

export function readStatusPagePublicFlag(env: NodeJS.Dict<string>): boolean | null {
  return flag(env.STATUS_PAGE_PUBLIC);
}

export type LaunchGateInput = {
  chainId: number | null;
  publicChainId: number | null;
  publicRpcUrl: string | null;
  contractsOk: boolean;
};

/** Browser may use a public chain RPC (not Anvil). */
export function isPublicChainConfigured(input: LaunchGateInput, env: NodeJS.Dict<string> = process.env): boolean {
  const explicit = readPublicChainConfiguredFlag(env);
  if (explicit === false) return false;
  if (input.chainId === LOCAL_CHAIN_ID || input.publicChainId === LOCAL_CHAIN_ID) return false;
  if (!input.publicChainId || !input.publicRpcUrl) return false;
  if (explicit === true) return true;
  return !isProductionEnv(env);
}

/**
 * Wallet create/buy/sell against FusedFactory.
 * Production defaults to false until PUBLIC_LAUNCH_ENABLED=true and real contracts exist.
 * Local Anvil stays enabled when factory/locker + RPC are set.
 */
export function isPublicLaunchEnabled(input: LaunchGateInput, env: NodeJS.Dict<string> = process.env): boolean {
  const explicit = readPublicLaunchEnabledFlag(env);
  if (explicit === false) return false;
  if (!input.contractsOk) return false;
  if (!input.publicChainId || !input.publicRpcUrl) return false;
  if (isProductionEnv(env) && (input.chainId === LOCAL_CHAIN_ID || input.publicChainId === LOCAL_CHAIN_ID)) {
    return false;
  }
  if (explicit === true) return true;
  if (isProductionEnv(env)) return false;
  return input.chainId === LOCAL_CHAIN_ID;
}

/** Developer /status. Production is off unless STATUS_PAGE_PUBLIC=1. */
export function isStatusPageEnabled(env: NodeJS.Dict<string> = process.env): boolean {
  const explicit = readStatusPagePublicFlag(env);
  if (explicit === true) return true;
  if (explicit === false) return false;
  return !isProductionEnv(env);
}
