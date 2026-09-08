import { loadEnv, loadPublicEnv, systemStatus, walletAvailability } from "@fused-ai/config";
import { listDexAdapters, loadAssetRegistry } from "@fused-ai/blockchain";
import { createSocialProvider } from "@fused-ai/social";
import type { WalletRuntimeConfig } from "../components/Providers.tsx";

export async function loadRuntime() {
  const env = loadEnv();
  const pub = loadPublicEnv();
  const status = systemStatus(env);
  const dex = listDexAdapters(env).map((adapter) => adapter.info());
  const social = createSocialProvider(env).availability();
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
}
