import { AVAILABILITY_STATUS, notConfigured, type Availability } from "@fused-ai/types";

/**
 * Browser-safe env. Only NEXT_PUBLIC_* keys. Never read AI, X, database, or
 * server RPC secrets here — those must not ship in the client bundle.
 */
export type PublicEnv = {
  appUrl: string;
  chainId: number | null;
  rpcUrl: string | null;
  walletConnectProjectId: string | null;
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
  return {
    appUrl: read("NEXT_PUBLIC_APP_URL", env) ?? "http://localhost:3000",
    chainId: readInt("NEXT_PUBLIC_CHAIN_ID", env),
    rpcUrl: read("NEXT_PUBLIC_RPC_URL", env),
    walletConnectProjectId: read("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID", env),
  };
}

export function publicWalletAvailability(pub: PublicEnv): Availability {
  const missing: string[] = [];
  if (!pub.chainId) missing.push("NEXT_PUBLIC_CHAIN_ID");
  if (!pub.rpcUrl) missing.push("NEXT_PUBLIC_RPC_URL");
  if (missing.length) {
    return notConfigured(missing, "Browser wallet is not configured.");
  }
  return { status: AVAILABILITY_STATUS.OK };
}
