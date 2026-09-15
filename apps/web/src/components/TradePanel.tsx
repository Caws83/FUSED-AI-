"use client";

import { useEffect, useMemo, useState } from "react";
import { parseEther, formatEther } from "viem";
import { useAccount, useChainId, useConfig, usePublicClient } from "wagmi";
import { Button } from "@fused-ai/ui";
import {
  ERC20_ABI,
  FUSED_ERROR_MESSAGES,
  FUSED_FACTORY_ABI,
  clampSlippageBps,
  minOut,
} from "@fused-ai/blockchain/fused";
import { formatEth, formatToken } from "../lib/format.ts";
import { writeClientError } from "../lib/wallet.ts";
import { resolveWriteClients } from "../lib/wallet-clients.ts";

const QUICK_ETH = ["0.01", "0.05", "0.1", "0.5"] as const;
const SELL_PCTS = [25, 50, 75, 100] as const;

export function TradePanel({
  factory,
  token,
  symbol,
  graduated,
  expectedChainId,
  onTraded,
}: {
  factory: `0x${string}`;
  token: `0x${string}`;
  symbol: string;
  graduated: boolean;
  expectedChainId?: number | null;
  onTraded?: () => void;
}) {
  const { address, isConnected, connector } = useAccount();
  const chainId = useChainId();
  const config = useConfig();
  const publicClient = usePublicClient({ chainId });
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [ethIn, setEthIn] = useState("0.05");
  const [tokenIn, setTokenIn] = useState("");
  const [slippage, setSlippage] = useState("1");
  const [quoteOut, setQuoteOut] = useState<bigint | null>(null);
  const [impact, setImpact] = useState<string | null>(null);
  const [balance, setBalance] = useState<bigint>(0n);
  const [ethBal, setEthBal] = useState<bigint>(0n);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const slippageBps = clampSlippageBps(Number(slippage) * 100);

  useEffect(() => {
    if (!publicClient || !address) return;
    void Promise.all([
      publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: "balanceOf", args: [address] }),
      publicClient.getBalance({ address }),
    ]).then(([tok, eth]) => {
      setBalance(tok);
      setEthBal(eth);
    });
  }, [publicClient, address, token, txHash]);

  useEffect(() => {
    if (!publicClient) return;
    const client = publicClient;
    let cancelled = false;
    async function quote() {
      setError(null);
      try {
        if (side === "buy") {
          const value = parseEther(ethIn || "0");
          if (value === 0n) {
            if (!cancelled) setQuoteOut(null);
            return;
          }
          if (!graduated) {
            const [tokensOut, newPrice] = await client.readContract({
              address: factory,
              abi: FUSED_FACTORY_ABI,
              functionName: "quoteBuy",
              args: [token, value],
            });
            const market = await client.readContract({
              address: factory,
              abi: FUSED_FACTORY_ABI,
              functionName: "getMarket",
              args: [token],
            });
            if (!cancelled) {
              setQuoteOut(tokensOut);
              setImpact(impactLabel(market.priceX18, newPrice));
            }
          } else if (address) {
            const sim = await client.simulateContract({
              address: factory,
              abi: FUSED_FACTORY_ABI,
              functionName: "buy",
              args: [token, 0n, BigInt(Math.floor(Date.now() / 1000) + 600)],
              value,
              account: address,
            });
            if (!cancelled) {
              setQuoteOut(sim.result);
              setImpact(null);
            }
          }
        } else {
          const amt = tokenIn ? parseEther(tokenIn) : 0n;
          if (amt === 0n) {
            if (!cancelled) setQuoteOut(null);
            return;
          }
          if (!graduated) {
            const [ethOut, newPrice] = await client.readContract({
              address: factory,
              abi: FUSED_FACTORY_ABI,
              functionName: "quoteSell",
              args: [token, amt],
            });
            const market = await client.readContract({
              address: factory,
              abi: FUSED_FACTORY_ABI,
              functionName: "getMarket",
              args: [token],
            });
            if (!cancelled) {
              setQuoteOut(ethOut);
              setImpact(impactLabel(market.priceX18, newPrice));
            }
          } else if (address) {
            const sim = await client.simulateContract({
              address: factory,
              abi: FUSED_FACTORY_ABI,
              functionName: "sell",
              args: [token, amt, 0n, BigInt(Math.floor(Date.now() / 1000) + 600)],
              account: address,
            });
            if (!cancelled) {
              setQuoteOut(sim.result);
              setImpact(null);
            }
          }
        }
      } catch {
        if (!cancelled) {
          setQuoteOut(null);
          setImpact(null);
        }
      }
    }
    void quote();
    return () => {
      cancelled = true;
    };
  }, [publicClient, factory, token, side, ethIn, tokenIn, graduated, address]);

  const minimum = useMemo(() => (quoteOut != null ? minOut(quoteOut, slippageBps) : 0n), [quoteOut, slippageBps]);

  async function submit() {
    setError(null);
    setTxHash(null);
    if (!isConnected || !address) {
      setError(writeClientError("account"));
      return;
    }
    if (expectedChainId && chainId !== expectedChainId) {
      setError(writeClientError("chain"));
      return;
    }
    setPending(true);
    try {
      const resolved = await resolveWriteClients(config, { chainId: expectedChainId ?? chainId, account: address, connector });
      if (!resolved.ok) {
        setError(writeClientError(resolved.reason));
        return;
      }
      const { publicClient: writePublic, walletClient } = resolved;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
      if (side === "buy") {
        const value = parseEther(ethIn || "0");
        const { request } = await writePublic.simulateContract({
          address: factory,
          abi: FUSED_FACTORY_ABI,
          functionName: "buy",
          args: [token, minimum, deadline],
          value,
          account: address,
        });
        const hash = await walletClient.writeContract(request);
        setTxHash(hash);
        const receipt = await writePublic.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") setError("The transaction did not succeed.");
        else onTraded?.();
      } else {
        const amt = parseEther(tokenIn || "0");
        const allowance = await writePublic.readContract({
          address: token,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [address, factory],
        });
        if (allowance < amt) {
          const { request: approveReq } = await writePublic.simulateContract({
            address: token,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [factory, amt],
            account: address,
          });
          const approveHash = await walletClient.writeContract(approveReq);
          const approveRcpt = await writePublic.waitForTransactionReceipt({ hash: approveHash });
          if (approveRcpt.status !== "success") {
            setError("Approval did not succeed.");
            return;
          }
        }
        const { request } = await writePublic.simulateContract({
          address: factory,
          abi: FUSED_FACTORY_ABI,
          functionName: "sell",
          args: [token, amt, minimum, deadline],
          account: address,
        });
        const hash = await walletClient.writeContract(request);
        setTxHash(hash);
        const receipt = await writePublic.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") setError("The transaction did not succeed.");
        else onTraded?.();
      }
    } catch (caught) {
      setError(humanError(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <div className="fused-tabs">
        <button type="button" className="fused-tab" data-on={String(side === "buy")} onClick={() => setSide("buy")}>
          BUY
        </button>
        <button type="button" className="fused-tab" data-on={String(side === "sell")} onClick={() => setSide("sell")}>
          SELL
        </button>
      </div>
      {side === "buy" ? (
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          <label>
            ETH amount
            <input className="fused-input" value={ethIn} onChange={(e) => setEthIn(e.target.value)} />
          </label>
          <div className="fused-quick-row">
            {QUICK_ETH.map((q) => (
              <Button key={q} type="button" variant="ghost" onClick={() => setEthIn(q)}>
                {q}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          <label>
            {symbol} amount
            <input className="fused-input" value={tokenIn} onChange={(e) => setTokenIn(e.target.value)} />
          </label>
          <div className="fused-quick-row">
            {SELL_PCTS.map((pct) => (
              <Button
                key={pct}
                type="button"
                variant="ghost"
                onClick={() => setTokenIn(pct === 100 ? formatEther(balance) : formatEther((balance * BigInt(pct)) / 100n))}
              >
                {pct === 100 ? "MAX" : `${pct}%`}
              </Button>
            ))}
          </div>
        </div>
      )}
      <label style={{ display: "block", marginTop: 12 }}>
        Slippage %
        <input className="fused-input" value={slippage} onChange={(e) => setSlippage(e.target.value)} />
      </label>
      <dl className="fused-review" style={{ marginTop: 14 }}>
        <div>
          <dt>{side === "buy" ? "Tokens received" : "ETH received"}</dt>
          <dd>{quoteOut == null ? "—" : side === "buy" ? formatToken(quoteOut) : formatEth(quoteOut)}</dd>
        </div>
        <div>
          <dt>Price impact</dt>
          <dd>{impact ?? (graduated ? "DEX quote" : "—")}</dd>
        </div>
        <div>
          <dt>Minimum received</dt>
          <dd>{quoteOut == null ? "—" : side === "buy" ? formatToken(minimum) : formatEth(minimum)}</dd>
        </div>
        <div>
          <dt>Wallet</dt>
          <dd>
            {formatEth(ethBal)} · {formatToken(balance)} {symbol}
          </dd>
        </div>
      </dl>
      {!isConnected ? <p style={{ color: "var(--fused-muted)" }}>Connect a wallet to trade.</p> : null}
      {error ? <p className="fused-form-error">{error}</p> : null}
      {txHash ? (
        <p style={{ fontSize: 13, wordBreak: "break-all", color: "var(--fused-muted)" }}>{txHash}</p>
      ) : null}
      <Button type="button" variant="lime" disabled={pending || !isConnected} onClick={() => void submit()}>
        {pending ? "Confirming…" : side === "buy" ? `BUY $${symbol}` : `SELL $${symbol}`}
      </Button>
    </div>
  );
}

function impactLabel(oldP: bigint, newP: bigint): string {
  if (oldP === 0n) return "—";
  const bps = Number(((newP - oldP) * 10_000n) / oldP);
  return `${(bps / 100).toFixed(2)}%`;
}

function humanError(caught: unknown): string {
  const text = caught instanceof Error ? caught.message : String(caught);
  for (const [code, message] of Object.entries(FUSED_ERROR_MESSAGES)) {
    if (text.includes(code)) return message;
  }
  if (text.includes("User rejected") || text.includes("denied")) return "Signature declined.";
  return text.slice(0, 280);
}
