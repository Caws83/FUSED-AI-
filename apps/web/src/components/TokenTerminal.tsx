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

import {
  chainLabelFor,
  nativeCurrencyFor,
} from "../lib/wallet.ts";

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
  launch: IndexedLaunch & {
    blockNumber: string;
  };
  trades: TradeRow[];
  candles: Record<string, Candle[]>;
  stats: {
    volumeTotal: string;
    volume24h: string;
    tradeCount: number;
    holderCount: number;
  };
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
        const res = await fetch(
          `/api/token/${initial.token}/live?chainId=${chainId}`,
          { cache: "no-store" },
        );

        const json = (await res.json()) as LivePayload;

        if (!stop && json.ok) {
          setLive(json);
        }
      } catch {
        // Keep last known state.
      }
    }

    void tick();

    const id = setInterval(() => {
      void tick();
    }, 4000);

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

  const candles =
    live?.candles?.[String(intervalSec)] ?? [];

  const trades = live?.trades ?? [];

  const graduated =
    stateBadge(
      launch.lifecycleState,
      launch.dexVersion,
    ) === "GRADUATED";

  const progress = progressFromLaunch(launch);

  const quoteSymbol =
    nativeCurrencyFor(chainId).symbol;

  const price = BigInt(launch.priceX18 ?? "0");
  const circ = BigInt(launch.circulating ?? "0");
  const supply = BigInt(launch.supply ?? "0");

  const mc =
    price > 0n && circ > 0n
      ? marketCapWei(price, circ)
      : 0n;

  const fdv =
    price > 0n && supply > 0n
      ? fdvWei(price, supply)
      : 0n;

  const image = tokenImageSrc(
    launch.imageUrl,
    launch.chainId ?? chainId,
  );

  return (
    <div className="fused-terminal">
      <main className="fused-terminal-main">
        {/* TOKEN HEADER */}
        <Card>
          <div className="fused-token-header">
            <img
              src={image}
              alt=""
              width={64}
              height={64}
              className="fused-token-image"
            />

            <div className="fused-token-heading">
              <div className="fused-token-title-row">
                <h1 className="fused-token-title">
                  {launch.name || "Token"}
                </h1>

                <span className="fused-token-symbol">
                  {launch.symbol}
                </span>
              </div>

              <div className="fused-token-meta">
                <Badge tone={graduated ? "blue" : "lime"}>
                  {graduated ? "GRADUATED" : "CURVE"}
                </Badge>

                {graduated ? (
                  <Badge tone="blue">
                    Uniswap V4
                  </Badge>
                ) : null}

                {indexing && !live ? (
                  <Badge tone="blue">
                    Indexing…
                  </Badge>
                ) : null}

                <span>
                  {chainLabelFor(chainId) ??
                    `Chain ${chainId}`}
                </span>

                <span className="fused-token-address">
                  {launch.token}
                </span>
              </div>
            </div>
          </div>

          <div className="fused-token-stats">
            <TerminalStat
              label="Price"
              value={formatNative(
                launch.priceX18,
                quoteSymbol,
                8,
              )}
            />

            <TerminalStat
              label="Market cap"
              value={formatNative(
                mc.toString(),
                quoteSymbol,
              )}
            />

            <TerminalStat
              label="FDV"
              value={formatNative(
                fdv.toString(),
                quoteSymbol,
              )}
            />

            <TerminalStat
              label="24h volume"
              value={formatNative(
                stats.volume24h,
                quoteSymbol,
              )}
            />

            <TerminalStat
              label="Trades"
              value={stats.tradeCount.toLocaleString()}
            />

            <TerminalStat
              label="Holders"
              value={stats.holderCount.toLocaleString()}
            />
          </div>
        </Card>

        {/* CHART */}
        <Card>
          <div className="fused-chart-header">
            <div>
              <p className="fused-kicker">
                Price
              </p>

              <strong className="fused-chart-price">
                {formatNative(
                  launch.priceX18,
                  quoteSymbol,
                  8,
                )}
              </strong>
            </div>

            <div className="fused-interval-row">
              {INTERVALS.map((item) => (
                <button
                  key={item.sec}
                  type="button"
                  className="fused-tab"
                  data-on={String(
                    intervalSec === item.sec,
                  )}
                  onClick={() =>
                    setIntervalSec(item.sec)
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <CandleChart
            candles={candles}
            emptyLabel={
              indexing && candles.length === 0
                ? "Indexing…"
                : "No trades yet"
            }
          />
        </Card>

        {/* TRADES */}
        <Card>
          <div className="fused-section-header">
            <div>
              <p className="fused-kicker">
                Recent activity
              </p>

              <h2 className="fused-section-title">
                Trades
              </h2>
            </div>

            <span className="fused-section-count">
              {trades.length}
            </span>
          </div>

          {trades.length === 0 ? (
            <div className="fused-empty-state">
              {indexing
                ? "Indexing trades…"
                : "No trades yet."}
            </div>
          ) : (
            <div className="fused-table-wrap">
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
                    const buy =
                      row.is_buy === true ||
                      row.is_buy === "t" ||
                      row.is_buy === "true";

                    const href = explorerTx(
                      chainId,
                      row.tx_hash,
                    );

                    return (
                      <tr
                        key={`${row.tx_hash}-${row.traded_at}`}
                      >
                        <td>
                          {formatAge(
                            row.traded_at,
                            "0",
                          )}
                        </td>

                        <td>
                          <span
                            className={
                              buy
                                ? "fused-trade-type fused-buy"
                                : "fused-trade-type fused-sell"
                            }
                          >
                            {buy ? "BUY" : "SELL"}
                          </span>
                        </td>

                        <td>
                          {formatNative(
                            row.quote_amount,
                            quoteSymbol,
                          )}
                        </td>

                        <td>
                          {formatToken(
                            row.token_amount,
                          )}
                        </td>

                        <td>
                          {formatNative(
                            row.price_x18,
                            quoteSymbol,
                            8,
                          )}
                        </td>

                        <td>
                          {shortAddr(row.trader)}
                        </td>

                        <td>
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {shortAddr(
                                row.tx_hash,
                              )}
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
            <p className="fused-kicker">
              Origin
            </p>

            <h2 className="fused-section-title">
              Source post
            </h2>

            <p className="fused-muted-copy">
              Fused from a public post. The token
              creator is the wallet that signed, not
              necessarily the original author.
            </p>

            {launch.sourceAuthor ? (
              <strong>
                @{launch.sourceAuthor}
              </strong>
            ) : null}

            {launch.sourceExcerpt ? (
              <p className="fused-source-excerpt">
                {launch.sourceExcerpt}
              </p>
            ) : null}

            <a
              href={launch.sourcePostUrl}
              target="_blank"
              rel="noreferrer"
            >
              View original post
            </a>
          </Card>
        ) : null}
      </main>

      {/* RIGHT SIDEBAR */}
      <aside className="fused-terminal-sidebar">
        <Card>
          <div className="fused-section-header">
            <div>
              <p className="fused-kicker">
                Trade
              </p>

              <h2 className="fused-section-title">
                {launch.symbol || "Token"}
              </h2>
            </div>
          </div>

          {factory ? (
            <TradePanel
              factory={factory}
              token={launch.token}
              symbol={
                launch.symbol || "TOKEN"
              }
              graduated={graduated}
              expectedChainId={chainId}
              onTraded={() =>
                setRefresh((n) => n + 1)
              }
            />
          ) : (
            <p className="fused-muted-copy">
              Trading is temporarily unavailable.
            </p>
          )}
        </Card>

        <Card>
          <div className="fused-section-header">
            <div>
              <p className="fused-kicker">
                Bonding curve
              </p>

              <strong className="fused-curve-percent">
                {(progress / 100).toFixed(1)}%
              </strong>
            </div>

            <span
              className={
                graduated
                  ? "fused-status-dot is-complete"
                  : "fused-status-dot"
              }
            />
          </div>

          <div className="fused-progress">
            <i
              style={{
                width: `${progress / 100}%`,
              }}
            />
          </div>

          <dl className="fused-review">
            <div>
              <dt>{quoteSymbol} raised</dt>
              <dd>
                {formatNative(
                  launch.realQuote,
                  quoteSymbol,
                )}
              </dd>
            </div>

            <div>
              <dt>Graduation target</dt>
              <dd>
                {formatNative(
                  launch.graduationTarget,
                  quoteSymbol,
                )}
              </dd>
            </div>

            {graduationTargetUsd ? (
              <div>
                <dt>USD estimate</dt>
                <dd>
                  ~$
                  {graduationTargetUsd.toLocaleString()}
                </dd>
              </div>
            ) : null}

            <div>
              <dt>Remaining</dt>

              <dd>
                {graduated
                  ? "Graduated"
                  : formatNative(
                      (
                        BigInt(
                          launch.graduationTarget ??
                            "0",
                        ) -
                          BigInt(
                            launch.realQuote ??
                              "0",
                          ) >
                        0n
                          ? BigInt(
                              launch.graduationTarget ??
                                "0",
                            ) -
                            BigInt(
                              launch.realQuote ??
                                "0",
                            )
                          : 0n
                      ).toString(),
                      quoteSymbol,
                    )}
              </dd>
            </div>

            <div>
              <dt>Status</dt>
              <dd>
                {graduated
                  ? "Graduated · Uniswap V4"
                  : "Curve active"}
              </dd>
            </div>
          </dl>
        </Card>
      </aside>
    </div>
  );
}

function TerminalStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="fused-terminal-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}