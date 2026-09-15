"use client";

import { useEffect, useState } from "react";
import { useAccount, useConfig, usePublicClient } from "wagmi";
import { Button, Card } from "@fused-ai/ui";
import { FUSED_ERROR_MESSAGES, FUSED_FACTORY_CLAIM_ABI } from "@fused-ai/blockchain/fused";
import { formatNative } from "../lib/format.ts";
import { asLaunchAddress, chainLabelFor, isWalletSelectorChain, nativeCurrencyFor, newLaunchForWallet, writeClientError } from "../lib/wallet.ts";
import { resolveWriteClients } from "../lib/wallet-clients.ts";

type EligibleLaunch = {
  token: string;
  name: string;
  symbol: string;
  chainId: number;
  factory: string | null;
};

export function CreatorRewards() {
  const { address, isConnected, connector, chainId: walletChainId } = useAccount();
  const config = useConfig();
  const launch = isConnected ? newLaunchForWallet(walletChainId) : null;
  const factory = asLaunchAddress(launch?.factory ?? null);
  const chainId = launch?.chainId ?? null;
  const publicClient = usePublicClient({ chainId: chainId ?? undefined });
  const [claimable, setClaimable] = useState<bigint | null>(null);
  const [launches, setLaunches] = useState<EligibleLaunch[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  const quoteSymbol = nativeCurrencyFor(chainId).symbol;
  const chainName = chainLabelFor(chainId) ?? (walletChainId ? `Chain ${walletChainId}` : "this network");
  const canListIndexed = isWalletSelectorChain(chainId);

  useEffect(() => {
    let stop = false;
    async function load() {
      setError(null);
      if (!factory || !chainId || !address || !publicClient) {
        setClaimable(null);
        setLaunches([]);
        return;
      }
      try {
        const [amount, listed] = await Promise.all([
          publicClient.readContract({
            address: factory,
            abi: FUSED_FACTORY_CLAIM_ABI,
            functionName: "claimable",
            args: [address],
          }),
          canListIndexed
            ? fetch(`/api/rewards/creator?address=${address}&chainId=${chainId}`, { cache: "no-store" }).then(async (res) => {
                const json = (await res.json()) as { ok?: boolean; chainId?: number; launches?: EligibleLaunch[] };
                if (!json.ok || json.chainId !== chainId || !Array.isArray(json.launches)) return [];
                return json.launches.filter((row) => row.chainId === chainId);
              })
            : Promise.resolve([]),
        ]);
        if (!stop) {
          setClaimable(amount);
          setLaunches(listed);
        }
      } catch {
        if (!stop) {
          setClaimable(null);
          setError("Could not read on-chain creator rewards.");
        }
      }
    }
    void load();
    return () => {
      stop = true;
    };
  }, [factory, chainId, address, publicClient, refresh, canListIndexed]);

  async function onClaim() {
    setError(null);
    setTxHash(null);
    if (!isConnected || !address) {
      setError(writeClientError("account"));
      return;
    }
    const live = newLaunchForWallet(walletChainId);
    const liveFactory = asLaunchAddress(live?.factory ?? null);
    if (!live || !liveFactory) {
      setError(writeClientError("chain"));
      return;
    }
    if (claimable == null || claimable === 0n) return;
    setPending(true);
    try {
      const resolved = await resolveWriteClients(config, { chainId: live.chainId, account: address, connector });
      if (!resolved.ok) {
        setError(writeClientError(resolved.reason));
        return;
      }
      const { publicClient: writePublic, walletClient } = resolved;
      const { request } = await writePublic.simulateContract({
        address: liveFactory,
        abi: FUSED_FACTORY_CLAIM_ABI,
        functionName: "claim",
        args: [],
        account: address,
      });
      const hash = await walletClient.writeContract(request);
      setTxHash(hash);
      const receipt = await writePublic.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        setError("The transaction did not succeed.");
        return;
      }
      setRefresh((n) => n + 1);
    } catch (caught) {
      const name =
        caught && typeof caught === "object" && "shortMessage" in caught
          ? String((caught as { shortMessage?: string }).shortMessage)
          : "";
      const mapped = Object.entries(FUSED_ERROR_MESSAGES).find(([key]) => name.includes(key));
      setError(mapped?.[1] ?? (caught instanceof Error ? caught.message : "Claim failed."));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <p className="fused-kicker">Creator Rewards</p>
      <h2 className="fused-h2" style={{ fontSize: 28, marginTop: 0 }}>
        Available Curve Rewards
      </h2>
      {!isConnected || !address ? (
        <p style={{ color: "var(--fused-muted)", marginBottom: 0 }}>Connect a wallet to view claimable curve rewards.</p>
      ) : !factory || !chainId ? (
        <p style={{ color: "var(--fused-muted)", marginBottom: 0 }}>
          Creator rewards are not live on this network. Switch to Robinhood Testnet or Arc Testnet.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <div style={{ color: "var(--fused-muted)", fontSize: 13 }}>
              {chainName} · {quoteSymbol}
            </div>
            <strong style={{ fontSize: 28 }}>{claimable == null ? "—" : formatNative(claimable.toString(), quoteSymbol, 8)}</strong>
          </div>
          <div>
            <div style={{ color: "var(--fused-muted)", fontSize: 13, marginBottom: 8 }}>Eligible launches on {chainName}</div>
            {!canListIndexed ? (
              <p style={{ color: "var(--fused-muted)", margin: 0 }}>
                Launch history for this chain is not indexed on this app instance. On-chain claimable above is still for{" "}
                {chainName} only.
              </p>
            ) : launches.length === 0 ? (
              <p style={{ color: "var(--fused-muted)", margin: 0 }}>No launches from this wallet on this chain yet.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {launches.map((row) => (
                  <li key={row.token}>
                    {row.name || row.symbol || "Token"} {row.symbol ? `(${row.symbol})` : ""}{" "}
                    <span style={{ color: "var(--fused-muted)", fontSize: 13, wordBreak: "break-all" }}>{row.token}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Button type="button" disabled={pending || claimable == null || claimable === 0n} onClick={() => void onClaim()}>
            {pending ? "Claiming…" : "CLAIM REWARDS"}
          </Button>
          {txHash ? (
            <p style={{ color: "var(--fused-muted)", margin: 0, wordBreak: "break-all" }}>Confirmed {txHash}</p>
          ) : null}
          {error ? <p style={{ color: "var(--fused-danger, #c44)", margin: 0 }}>{error}</p> : null}
          <p style={{ color: "var(--fused-muted)", fontSize: 13, margin: 0 }}>
            Shows on-chain claimable curve fees for the connected chain only. Rewards on other chains are not added
            together. Graduated Uniswap V4 creator fees paid during collect are not listed here.
          </p>
        </div>
      )}
    </Card>
  );
}
