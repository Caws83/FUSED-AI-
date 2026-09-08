import { loadEnv, systemStatus, walletAvailability } from "@fused-ai/config";
import { listDexAdapters, loadAssetRegistry } from "@fused-ai/blockchain";
import { createSocialProvider } from "@fused-ai/social";
import type { WalletRuntimeConfig } from "../components/Providers.tsx";

export async function loadRuntime() {
  const env = loadEnv();
  const status = systemStatus(env);
  const dex = listDexAdapters(env).map((adapter) => adapter.info());
  const social = createSocialProvider(env).availability();
  const registry = await loadAssetRegistry(env.tokenizedAssetRegistryPath);
  const walletOk = walletAvailability(env).status === "OK";
  const wallet: WalletRuntimeConfig | null =
    walletOk && env.chainId && env.rpcUrl
      ? {
          chainId: env.chainId,
          rpcUrl: env.rpcUrl,
          walletConnectProjectId: env.walletConnectProjectId,
        }
      : null;
  return { env, status, dex, social, registry, wallet };
}
