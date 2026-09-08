import type { TokenizedAsset } from "@fused-ai/types";
import { isHexAddress, lowercaseAddress } from "@fused-ai/shared";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * An asset is accepted only when chainId + contractAddress + issuer are present.
 * Symbol matching is never sufficient.
 */
export function parseTokenizedAsset(input: unknown): TokenizedAsset | null {
  if (!isRecord(input)) return null;
  const chainId = input.chainId;
  const contractAddress = typeof input.contractAddress === "string" ? input.contractAddress : "";
  const issuer = typeof input.issuer === "string" ? input.issuer.trim() : "";
  const symbol = typeof input.symbol === "string" ? input.symbol.trim().toUpperCase() : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const decimals = input.decimals;
  const enabled = input.enabled === true;
  const sourceRegistry = typeof input.sourceRegistry === "string" ? input.sourceRegistry : "";
  const verifiedAt = typeof input.verifiedAt === "string" ? input.verifiedAt : "";
  if (typeof chainId !== "number" || !Number.isInteger(chainId) || chainId <= 0) return null;
  if (!isHexAddress(contractAddress)) return null;
  if (!issuer || issuer.length > 80) return null;
  if (!/^[A-Z0-9.\-]{1,16}$/.test(symbol)) return null;
  if (!name || name.length > 80) return null;
  if (typeof decimals !== "number" || !Number.isInteger(decimals) || decimals < 0 || decimals > 18) return null;
  if (!sourceRegistry) return null;
  if (Number.isNaN(Date.parse(verifiedAt))) return null;
  const oracle = isRecord(input.oracle) ? input.oracle : null;
  if (!oracle) return null;
  const kind = oracle.kind;
  if (kind !== "chainlink" && kind !== "issuer-api" && kind !== "uniswap-twap" && kind !== "none") return null;
  const maxAgeSeconds = oracle.maxAgeSeconds;
  if (typeof maxAgeSeconds !== "number" || maxAgeSeconds <= 0) return null;
  const jurisdictions = Array.isArray(input.jurisdictionsRestricted)
    ? input.jurisdictionsRestricted.filter((x): x is string => typeof x === "string").map((x) => x.toUpperCase())
    : [];
  return {
    chainId,
    contractAddress: lowercaseAddress(contractAddress) as TokenizedAsset["contractAddress"],
    issuer,
    symbol,
    name,
    decimals,
    oracle: {
      kind,
      feedAddress:
        typeof oracle.feedAddress === "string" && isHexAddress(oracle.feedAddress)
          ? (lowercaseAddress(oracle.feedAddress) as TokenizedAsset["contractAddress"])
          : undefined,
      feedUrl: typeof oracle.feedUrl === "string" ? oracle.feedUrl : undefined,
      maxAgeSeconds,
    },
    enabled,
    jurisdictionsRestricted: jurisdictions,
    sourceRegistry,
    verifiedAt,
  };
}

export function parseTokenizedAssetRegistry(input: unknown): TokenizedAsset[] {
  const rows = Array.isArray(input) ? input : isRecord(input) && Array.isArray(input.assets) ? input.assets : [];
  const out: TokenizedAsset[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const asset = parseTokenizedAsset(row);
    if (!asset) continue;
    const key = `${asset.chainId}:${asset.contractAddress}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(asset);
  }
  return out;
}

export function lookupTokenizedAsset(
  registry: readonly TokenizedAsset[],
  chainId: number,
  contractAddress: string,
): TokenizedAsset | null {
  if (!isHexAddress(contractAddress)) return null;
  const addr = lowercaseAddress(contractAddress);
  return registry.find((a) => a.chainId === chainId && a.contractAddress === addr && a.enabled) ?? null;
}

/** Intentionally always null — tickers are not identifiers. */
export function lookupBySymbol(_registry: readonly TokenizedAsset[], _symbol: string): null {
  return null;
}
