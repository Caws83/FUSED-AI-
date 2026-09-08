import { readFile } from "node:fs/promises";
import type { TokenizedAsset } from "@fused-ai/types";
import { notConfigured } from "@fused-ai/types";
import type { Result } from "@fused-ai/shared";
import { err, ok } from "@fused-ai/shared";
import { lookupTokenizedAsset, parseTokenizedAssetRegistry } from "@fused-ai/validation";

export async function loadAssetRegistry(path: string | null): Promise<Result<readonly TokenizedAsset[]>> {
  if (!path) return err(notConfigured(["TOKENIZED_ASSET_REGISTRY_PATH"]));
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (e) {
    return err({
      status: "NOT_CONFIGURED",
      missing: ["TOKENIZED_ASSET_REGISTRY_PATH"],
      reason: `Asset registry unreadable: ${e instanceof Error ? e.message : "unknown error"}`,
    });
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return err({ status: "NOT_CONFIGURED", reason: "Asset registry is not valid JSON" });
  }
  return ok(parseTokenizedAssetRegistry(json));
}

export function resolveAllowlistedAsset(
  registry: readonly TokenizedAsset[],
  chainId: number,
  contractAddress: string,
): TokenizedAsset | null {
  return lookupTokenizedAsset(registry, chainId, contractAddress);
}
