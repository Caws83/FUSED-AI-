"use client";

import { useEffect, useState } from "react";
import { Badge, Card } from "@fused-ai/ui";
import { tokenImageSrc } from "@fused-ai/media/token-image";
import type { IndexedLaunch } from "@fused-ai/types";
import { fdvWei, marketCapWei } from "@fused-ai/blockchain/fused";
import { CandleChart, type Candle } from "./CandleChart.tsx";
import { TradePanel } from "./TradePanel.tsx";
import {
  explorerTx,
  formatAge,
  formatNative,
  formatToken,
  progressFromLaunch,
  shortAddr,
  stateBadge,
} from "../lib/format.ts";
import { chainLabelFor, nativeCurrencyFor } from "../lib/wallet.ts";

type TradeRow = {
  traded_at: string;
  is_buy: boolean | string;
  quote_amount: string;
  token_amount: string;
  price_x18: string;
  trader: string;
  tx_hash: string;
  venue: string;
};

type LivePayload = {
  ok: boolean;
  launch: IndexedLaunch & { blockNumber: string };
  trades: TradeRow[];
  candles: Record<string, Candle[]>;
  stats: { volumeTotal: string; volume24h: string; tradeCount: number; holderCount: number };
};

const INTERVALS = [
  { sec: 60, label: "1m" },
  { sec: 300, label: "5m" },
  { sec: 900, label: "15m" },
  { sec: 3600, label: "1h" },
] as const;

export function TokenTerminal({
  initial,
  factory,
  chainId,
  graduationTargetUsd = null,
  indexing = false,
}: {
  initial: IndexedLaunch;
  factory: `0x${string}` | null;
  chainId: number;
  graduationTargetUsd?: number | null;
  indexing?: boolean;
}) {
  const [live, setLive] = useState<LivePayload | null>(null);
  const [intervalSec, setIntervalSec] = useState(60);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let stop = false;
    async function tick() {
      try {
        const res = await fetch(`/api/token/${initial.token}/live?chainId=${chainId}`, { cache: "no-store" });
        const json = (await res.json()) as LivePayload;
        if (!stop && json.ok) setLive(json);
      } catch {
        /* keep last */
      }
    }
    void tick();
    const id = setInterval(() => void tick(), 4000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [initial.token, chainId, refresh]);

  const launch = live?.launch ?? {
    ...initial,
    blockNumber: initial.blockNumber.toString(),
  };
  const stats = live?.stats ?? {
    volumeTotal: initial.volumeQuote ?? "0",
    volume24h: "0",
    tradeCount: 0,
    holderCount: initial.holderCount ?? 0,
  };
  const candles = live?.candles?.[String(intervalSec)] ?? [];
  const trades = live?.trades ?? [];
  const graduated = stateBadge(launch.lifecycleState, launch.dexVersion) === "GRADUATED";
  const progress = progressFromLaunch(launch);
  const quoteSymbol = nativeCurrencyFor(chainId).symbol;
  const price = BigInt(launch.priceX18 ?? "0");
  const circ = BigInt(launch.circulating ?? "0");
  const supply = BigInt(launch.supply ?? "0");
  const mc = price > 0n && circ > 0n ? marketCapWei(price, circ) : 0n;
  const fdv = price > 0n && supply > 0n ? fdvWei(price, supply) : 0n;
  const image = tokenImageSrc(launch.imageUrl, launch.chainId ?? chainId);

  return (
    <div className="fused-terminal">
      <div style={{ display: "grid", gap: 18 }}>
        <Card>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <img src={image} alt="" width={72} height={72} style={{ borderRadius: 18, objectFit: "cover" }} />
            <div>
              <h1 className="fused-h2" style={{ margin: 0, fontSize: 32 }}>
                {launch.name || "Token"} <span style={{ color: "var(--fused-muted)" }}>{launch.symbol}</span>
              </h1>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <Badge tone={graduated ? "blue" : "lime"}>{graduated ? "GRADUATED" : "CURVE"}</Badge>
                {graduated ? <Badge tone="blue">Uniswap V4</Badge> : null}
                {indexing && !live ? <Badge tone="blue">Indexing…</Badge> : null}
                <span style={{ color: "var(--fused-muted)", fontSize: 13 }}>{chainLabelFor(chainId) ?? `Chain ${chainId}`}</span>
                <span style={{ color: "var(--fused-muted)", fontSize: 13, wordBreak: "break-all" }}>{launch.token}</span>
              </div>
            </div>
          </div>
          <div className="fused-stats" style={{ marginTop: 16 }}>
            <div className="fused-stat">
              <span>Price</span>
              <strong>{formatNative(launch.priceX18, quoteSymbol, 8)}</strong>
            </div>
            <div className="fused-stat">
              <span>Market cap</span>
              <strong>{formatNative(mc.toString(), quoteSymbol)}</strong>
            </div>
            <div className="fused-stat">
              <span>FDV</span>
              <strong>{formatNative(fdv.toString(), quoteSymbol)}</strong>
            </div>
            <div className="fused-stat">
              <span>24h volume</span>
              <strong>{formatNative(stats.volume24h, quoteSymbol)}</strong>
            </div>
            <div className="fused-stat">
              <span>Total volume</span>
              <strong>{formatNative(stats.volumeTotal, quoteSymbol)}</strong>
            </div>
            <div className="fused-stat">
              <span>Trades</span>
              <strong>{stats.tradeCount}</strong>
            </div>
            <div className="fused-stat">
              <span>Holders</span>
              <strong>{stats.holderCount}</strong>
            </div>
            <div className="fused-stat">
              <span>Creator</span>
              <strong>{shortAddr(launch.launcher)}</strong>
            </div>
          </div>
        </Card>

        <Card>
          <div className="fused-interval-row" style={{ marginBottom: 10 }}>
            {INTERVALS.map((item) => (
              <button
                key={item.sec}
                type="button"
                className="fused-tab"
                data-on={String(intervalSec === item.sec)}
                onClick={() => setIntervalSec(item.sec)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <CandleChart candles={candles} emptyLabel={indexing && candles.length === 0 ? "Indexing…" : "No trades yet"} />
        </Card>

        <Card>
          <p className="fused-kicker">Trades</p>
          {trades.length === 0 ? (
            <p style={{ color: "var(--fused-muted)" }}>{indexing ? "Indexing…" : "No trades yet."}</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="fused-trades">
                <thead>
                  <tr>
                    <th>Age</th>
                    <th>Type</th>
                    <th>{quoteSymbol}</th>
                    <th>Token</th>
                    <th>Price</th>
                    <th>Wallet</th>
                    <th>Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((row) => {
                    const buy = row.is_buy === true || row.is_buy === "t" || row.is_buy === "true";
                    const href = explorerTx(chainId, row.tx_hash);
                    return (
                      <tr key={`${row.tx_hash}-${row.traded_at}`}>
                        <td>{formatAge(row.traded_at, "0")}</td>
                        <td className={buy ? "fused-buy" : "fused-sell"}>{buy ? "BUY" : "SELL"}</td>
                        <td>{formatNative(row.quote_amount, quoteSymbol)}</td>
                        <td>{formatToken(row.token_amount)}</td>
                        <td>{formatNative(row.price_x18, quoteSymbol, 8)}</td>
                        <td>{shortAddr(row.trader)}</td>
                        <td>
                          {href ? (
                            <a href={href} target="_blank" rel="noreferrer">
                              {shortAddr(row.tx_hash)}
                            </a>
                          ) : (
                            shortAddr(row.tx_hash)
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {launch.sourcePostUrl ? (
          <Card>
            <p className="fused-kicker">Origin post</p>
            <p style={{ marginTop: 0 }}>
              Fused from a public post. The token creator is the wallet that signed — not necessarily the original
              author.
            </p>
            {launch.sourceAuthor ? <strong>@{launch.sourceAuthor}</strong> : null}
            {launch.sourceExcerpt ? <p style={{ whiteSpace: "pre-wrap" }}>{launch.sourceExcerpt}</p> : null}
            <a href={launch.sourcePostUrl} target="_blank" rel="noreferrer">
              View original post
            </a>
          </Card>
        ) : null}
      </div>

      <div style={{ display: "grid", gap: 18 }}>
        <Card>
          <p className="fused-kicker">Trade</p>
          {factory ? (
            <TradePanel
              factory={factory}
              token={launch.token}
              symbol={launch.symbol || "TOKEN"}
              graduated={graduated}
              expectedChainId={chainId}
              onTraded={() => setRefresh((n) => n + 1)}
            />
          ) : (
            <p style={{ color: "var(--fused-muted)" }}>Trading is temporarily unavailable.</p>
          )}
        </Card>
        <Card>
          <p className="fused-kicker">Bonding curve</p>
          <strong style={{ fontSize: 28 }}>{(progress / 100).toFixed(1)}%</strong>
          <div className="fused-progress" style={{ margin: "10px 0 14px" }}>
            <i style={{ width: `${progress / 100}%` }} />
          </div>
          <dl className="fused-review">
            <div>
              <dt>{quoteSymbol} raised</dt>
              <dd>{formatNative(launch.realQuote, quoteSymbol)}</dd>
            </div>
            <div>
              <dt>Graduation target</dt>
              <dd>{formatNative(launch.graduationTarget, quoteSymbol)}</dd>
            </div>
            {graduationTargetUsd ? (
              <div>
                <dt>Display USD estimate</dt>
                <dd>~${graduationTargetUsd.toLocaleString()} (not a live price)</dd>
              </div>
            ) : null}
            <div>
              <dt>Remaining</dt>
              <dd>
                {graduated
                  ? "Graduated"
                  : formatNative(
                      (BigInt(launch.graduationTarget ?? "0") - BigInt(launch.realQuote ?? "0") > 0n
                        ? BigInt(launch.graduationTarget ?? "0") - BigInt(launch.realQuote ?? "0")
                        : 0n
                      ).toString(),
                      quoteSymbol,
                    )}
              </dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{graduated ? "Graduated · Uniswap V4" : "Curve active"}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  );
}
