import { getPublicClient, getWalletClient } from "wagmi/actions";
import type { Config, Connector } from "wagmi";
import type { Address } from "viem";
import type { WriteClientReason } from "./wallet.ts";

export async function resolveWriteClients(
  config: Config,
  input: { chainId: number; account: Address; connector?: Connector },
): Promise<
  | { ok: true; publicClient: NonNullable<ReturnType<typeof getPublicClient>>; walletClient: NonNullable<Awaited<ReturnType<typeof getWalletClient>>> }
  | { ok: false; reason: WriteClientReason }
> {
  const publicClient = getPublicClient(config, { chainId: input.chainId });
  if (!publicClient) return { ok: false, reason: "rpc" };
  try {
    const walletClient = await getWalletClient(config, {
      chainId: input.chainId,
      account: input.account,
      ...(input.connector ? { connector: input.connector } : {}),
    });
    if (!walletClient) return { ok: false, reason: "wallet" };
    return { ok: true, publicClient, walletClient };
  } catch {
    return { ok: false, reason: "wallet" };
  }
}
