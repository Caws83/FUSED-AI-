import { loadEnv, loadPublicEnv, systemStatus, walletAvailability } from "@fused-ai/config";
import { listDexAdapters } from "@fused-ai/blockchain";
import { loadAssetRegistry } from "@fused-ai/blockchain/registry";
import { createSocialProvider } from "@fused-ai/social";
import { notConfigured, type Availability } from "@fused-ai/types";
import type { WalletRuntimeConfig } from "./wagmi-config.ts";

export async function loadRuntime() {
  try {
    const env = loadEnv();
    const pub = loadPublicEnv();
    const status = systemStatus(env);
    const dex = listDexAdapters(env).map((adapter) => adapter.info());
    let social: Availability = notConfigured(["SOCIAL_PROVIDER"]);
    try {
      social = createSocialProvider(env).availability();
    } catch {
      /* optional */
    }
    const registry = await loadAssetRegistry(env.tokenizedAssetRegistryPath);
    const walletOk = walletAvailability(env).status === "OK";
    const wallet: WalletRuntimeConfig | null =
      walletOk && pub.chainId && pub.rpcUrl
        ? {
            chainId: pub.chainId,
            rpcUrl: pub.rpcUrl,
            walletConnectProjectId: pub.walletConnectProjectId,
          }
        : null;
    return { env, status, dex, social, registry, wallet };
  } catch {
    const env = loadEnv({});
    return {
      env,
      status: systemStatus(env),
      dex: listDexAdapters(env).map((adapter) => adapter.info()),
      social: notConfigured(["SOCIAL_PROVIDER"]),
      registry: { ok: false as const, error: notConfigured(["TOKENIZED_ASSET_REGISTRY_PATH"], "Registry unavailable") },
      wallet: null,
    };
  }
}
