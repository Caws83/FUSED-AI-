/** Deterministic Anvil CREATE addresses from a fresh local stack. Never use on a public chain. */
export const LOCAL_CHAIN_ID = 31337;

export const KNOWN_ANVIL_CREATE_ADDRESSES = new Set([
  "0x5fbdb2315678afecb367f032d93f642f64180aa3", // Uniswap v4 PoolManager (first Anvil create)
  "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512", // Uniswap v4 PositionManager
  "0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0", // FusedFactory
  "0x75537828f2ce51be7289709686a69cbfdbb714f1", // Fused LaunchLocker
]);

/** Canonical Permit2 CREATE2. Same on many public chains — do not treat as Anvil-only. */
export const CANONICAL_PERMIT2 = "0x000000000022d473030f116ddee9f6b43ac78ba3";

export function normalizeAddress(value: string): string {
  return value.trim().toLowerCase();
}

export function isKnownAnvilCreateAddress(value: string | null | undefined): boolean {
  if (!value) return false;
  return KNOWN_ANVIL_CREATE_ADDRESSES.has(normalizeAddress(value));
}

export function isProductionEnv(env: NodeJS.Dict<string> = process.env): boolean {
  const node = (env.NODE_ENV ?? "").toLowerCase();
  const vercel = (env.VERCEL_ENV ?? "").toLowerCase();
  return node === "production" || vercel === "production" || vercel === "preview";
}

export function isLocalhostHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0";
}

/** True for browser RPC, app URL, or Postgres URLs that point at this machine. */
export function isLocalhostUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  const raw = value.trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw.includes("://") ? raw : `http://${raw}`);
    return isLocalhostHost(parsed.hostname);
  } catch {
    return /localhost|127\.0\.0\.1|\[::1\]/i.test(raw);
  }
}

/**
 * Reject known Anvil CREATE addresses when they cannot be the local chain.
 * Identical bytes on another chain are still blocked because those deploys are
 * Anvil-nonce artifacts, not a public Fused deployment.
 */
export function shouldRejectAnvilAddress(
  address: string | null | undefined,
  chainId: number | null,
  env: NodeJS.Dict<string>,
): boolean {
  if (!isKnownAnvilCreateAddress(address)) return false;
  if (chainId === LOCAL_CHAIN_ID && !isProductionEnv(env)) return false;
  return true;
}

export function shouldRejectLocalhostUrl(value: string | null | undefined, env: NodeJS.Dict<string>): boolean {
  return isProductionEnv(env) && isLocalhostUrl(value);
}

/** Railway private DNS works inside Railway. Vercel cannot resolve it. */
export function isPrivateRailwayUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  const raw = value.trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw.includes("://") ? raw : `http://${raw}`);
    return parsed.hostname.toLowerCase().endsWith(".railway.internal");
  } catch {
    return /\.railway\.internal/i.test(raw);
  }
}

export function shouldRejectPrivateRailwayUrl(value: string | null | undefined, env: NodeJS.Dict<string>): boolean {
  return Boolean(env.VERCEL) && isPrivateRailwayUrl(value);
}
