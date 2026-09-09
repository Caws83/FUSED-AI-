/**
 * Bonding-curve constructor parameters are per-network. Local 0.1 ETH is a
 * test value. Public networks must pass an explicit native-quote target.
 * Do not fall back from Robinhood (or any public chain) to local defaults.
 */

export const LOCAL_CURVE = {
  network: "local" as const,
  chainId: 31337,
  virtualQuoteWei: "50000000000000000",
  virtualToken: "1000000000000000000000000000",
  graduationTargetWei: "100000000000000000",
  feeBps: 0,
  lpFee: 10_000,
  /** Display-only product intent. Not encoded in Solidity. */
  targetUsdDisplay: null as number | null,
};

/** Product intention for a public Fused curve. Not a contract constant. */
export const PUBLIC_GRADUATION_TARGET_USD = 50_000;

export const LOCAL_GRADUATION_TARGET_ETH = "0.1";

export type PublicCurveParams = {
  network: string;
  chainId: number;
  virtualQuoteWei: string;
  virtualToken: string;
  graduationTargetWei: string;
  feeBps: number;
  lpFee: number;
  targetUsdDisplay: number | null;
};

export type PublicCurveResult =
  | { ok: true; value: PublicCurveParams }
  | { ok: false; missing: readonly string[]; reason: string };

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

/** Local Anvil constructor args. Never returned for a public chainId. */
export function localCurveParams(): typeof LOCAL_CURVE {
  return { ...LOCAL_CURVE };
}

/**
 * Production/public deploy requires every field explicitly. Missing values do
 * not fall back to local 0.1 ETH / 0 bps. Fee 0 is allowed only if FUSED_FEE_BPS is set.
 */
export function requirePublicCurveParams(env: NodeJS.Dict<string>): PublicCurveResult {
  const missing: string[] = [];
  const network = read("FUSED_PUBLIC_NETWORK", env);
  const chainId = readInt("CHAIN_ID", env) ?? readInt("NEXT_PUBLIC_CHAIN_ID", env);
  const virtualQuoteWei = read("FUSED_VIRTUAL_QUOTE_WEI", env);
  const virtualToken = read("FUSED_VIRTUAL_TOKEN", env);
  const graduationTargetWei = read("FUSED_GRADUATION_TARGET_WEI", env);
  const feeRaw = read("FUSED_FEE_BPS", env);
  const lpRaw = read("FUSED_LP_FEE", env);
  if (!network) missing.push("FUSED_PUBLIC_NETWORK");
  if (chainId == null) missing.push("CHAIN_ID");
  if (!virtualQuoteWei) missing.push("FUSED_VIRTUAL_QUOTE_WEI");
  if (!virtualToken) missing.push("FUSED_VIRTUAL_TOKEN");
  if (!graduationTargetWei) missing.push("FUSED_GRADUATION_TARGET_WEI");
  if (feeRaw == null) missing.push("FUSED_FEE_BPS");
  if (lpRaw == null) missing.push("FUSED_LP_FEE");
  if (missing.length) {
    return {
      ok: false,
      missing,
      reason: "Public curve parameters must be set explicitly. Local 0.1 ETH / 0 fee defaults are not used.",
    };
  }
  if (chainId === 31337) {
    return {
      ok: false,
      missing: ["CHAIN_ID"],
      reason: "Public curve configuration cannot target the local Anvil chain.",
    };
  }
  if (graduationTargetWei === LOCAL_CURVE.graduationTargetWei) {
    return {
      ok: false,
      missing: ["FUSED_GRADUATION_TARGET_WEI"],
      reason: "Refusing the local 0.1 ETH graduation target on a public network.",
    };
  }
  const feeBps = Number(feeRaw);
  const lpFee = Number(lpRaw);
  if (!Number.isInteger(feeBps) || feeBps < 0) {
    return { ok: false, missing: ["FUSED_FEE_BPS"], reason: "FUSED_FEE_BPS must be an explicit non-negative integer." };
  }
  if (!Number.isInteger(lpFee) || lpFee <= 0) {
    return { ok: false, missing: ["FUSED_LP_FEE"], reason: "FUSED_LP_FEE must be an explicit positive integer." };
  }
  const usd = readInt("NEXT_PUBLIC_GRADUATION_TARGET_USD", env);
  return {
    ok: true,
    value: {
      network: network!,
      chainId: chainId!,
      virtualQuoteWei: virtualQuoteWei!,
      virtualToken: virtualToken!,
      graduationTargetWei: graduationTargetWei!,
      feeBps,
      lpFee,
      targetUsdDisplay: usd,
    },
  };
}

export function isLocalGraduationTargetWei(value: string | null | undefined): boolean {
  return Boolean(value && value === LOCAL_CURVE.graduationTargetWei);
}
