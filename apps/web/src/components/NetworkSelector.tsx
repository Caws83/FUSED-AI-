"use client";

import { useAccount, useSwitchChain } from "wagmi";
import {
  ROBINHOOD_MAINNET_CHAIN_ID,
  WALLET_SELECTOR_CHAIN_IDS,
  chainLabelFor,
  isWalletSelectorChain,
} from "@fused-ai/config/public";

export function NetworkSelector({
  preferredChainId,
  onPreferredChainId,
}: {
  preferredChainId: number;
  onPreferredChainId: (chainId: number) => void;
}) {
  const { isConnected, chainId: walletChainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  const selected =
    isConnected && isWalletSelectorChain(walletChainId) ? walletChainId : preferredChainId;

  async function onChange(next: number) {
    onPreferredChainId(next);
    if (!isConnected) return;
    if (walletChainId === next) return;
    try {
      await switchChain({ chainId: next });
    } catch {
      /* user rejected or wallet cannot add the chain */
    }
  }

  return (
    <label className="fused-network-select-wrap">
      <span className="fused-sr-only">Network</span>
      <select
        className="fused-network-select"
        aria-label="Network"
        disabled={isPending}
        value={selected}
        onChange={(event) => void onChange(Number(event.target.value))}
      >
        {WALLET_SELECTOR_CHAIN_IDS.map((id) => (
          <option key={id} value={id}>
            {chainLabelFor(id) ?? `Chain ${id}`}
          </option>
        ))}
      </select>
    </label>
  );
}

export const DEFAULT_PREFERRED_CHAIN_ID = ROBINHOOD_MAINNET_CHAIN_ID;
