# Charting

Charts are built from indexed trades. There are no screenshot placeholders and no random candles.

## Pipeline

1. Indexer reads `FusedFactory.Trade` (curve `venue=0`, Uniswap v4 `venue=1`).
2. Each trade is stored in `fused_trades`.
3. The same insert upserts OHLCV buckets in `fused_candles` for **1m, 5m, 15m, 1h**.
4. `/token/[address]` polls `/api/token/[address]/live` and draws candlesticks + volume on a canvas.

## `fused_trades`

`chain_id, token, tx_hash, log_index, block_number, traded_at, trader, is_buy, token_amount, quote_amount, price_x18, venue`

If a Uniswap trade emits `priceX18 = 0`, the indexer sets `quote * 1e18 / token`.

## `fused_candles`

Key: `(chain_id, token, interval_sec, bucket_start)`

`open/high/low/close` are `price_x18`. Volume is token + quote wei. `trade_count` increments per real trade.

Empty chart: “No trades yet.” Never invented OHLCV.

Local Anvil has no public explorer; tx hashes in the trades feed are plain text, not fake links.
