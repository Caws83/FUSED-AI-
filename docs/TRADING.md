# Trading

Fused AI trading is one BUY / SELL panel. Routing follows on-chain state.

| Token state | Execution |
|-------------|-----------|
| `CURVE` (`state = 1`) | `FusedFactory.buy` / `sell` on the virtual-reserve curve |
| `GRADUATED` (`state = 2`) | Same functions; factory swaps Uniswap v4 |

The user does not pick V2/V3/V4. V2 and V3 are not implemented.

## Quotes

Before graduation, `quoteBuy` / `quoteSell` use curve math (fees deducted if `feeBps > 0`).

After graduation those views revert `NotCurve`. The UI simulates `buy` / `sell` instead.

## Slippage

Default **1%**. Bounded to 1–5000 bps. Every tx sends `minTokensOut` / `minQuoteOut` plus a deadline.

This is **not** MEV protection. Public mempools can still sandwich curve or DEX swaps.

## Price, market cap, FDV

- **Price:** `virtualQuote * 1e18 / virtualToken` (ETH per token, 1e18 fixed) while on the curve. After graduation, last indexed trade: `quoteAmount * 1e18 / tokenAmount`.
- **Market cap:** `priceX18 * circulating / 1e18`
- **FDV:** `priceX18 * totalSupply / 1e18`

Values are ETH, from chain/index — not a USD oracle.

## Fees

Local deploy: **0 bps**. Constructor may set up to 100 bps with an immutable recipient. No owner can raise fees later.
