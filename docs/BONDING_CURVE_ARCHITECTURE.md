# Bonding curve architecture

Fused AI is a social-first launch **and trading** platform:

FUSE → CURVE → TRADE → GRADUATE → UNISWAP (locked LP)

This document is the Phase 5 design. It is **not** X’s algorithm and it is **not** a copy of Pump.fun source.

## Audit of imported OpenLaunch core

Inspected (byte-identical, do not mutate):

- `contracts/src/core/LaunchFactory.sol`
- `contracts/src/core/LaunchLocker.sol`
- `contracts/src/core/LaunchToken.sol`

Findings:

1. **Direct Uniswap.** `LaunchFactory.launch()` deploys a token and immediately mints **100% of supply** as a single-sided Uniswap v4 position. Buyers trade the v4 pool from block one.
2. **No bonding-curve phase.** There is no pre-DEX AMM, virtual reserve, or graduation threshold.
3. **No pre-graduation buy/sell.** The only buy/sell path is Uniswap v4.
4. **Do not alter core.** Forcing a curve into those contracts would break the imported security model (ownerless factory/locker, single-sided launch).
5. **Reuse after graduation.** `LaunchToken` (fixed ERC-20) and `LaunchLocker` (permanent v4 NFT home, collect-fees-only) are the right **post-graduation** primitives. A new Fused factory deploys **its own** `LaunchLocker` instance (factory = Fused factory) so `register()` still works without editing locker code.

OpenLaunch core remains the **graduated liquidity + lock** architecture, not the curve.

## Fused-owned contracts

| Contract | Role |
|----------|------|
| `src/fused/FusedCurveMath.sol` | Pure constant-product quotes |
| `src/fused/FusedFactory.sol` | Create token, curve buy/sell, permissionless graduate, post-grad v4 swap |
| `LaunchToken` (core, unmodified) | ERC-20 minted to the Fused factory |
| `LaunchLocker` (core, unmodified) | Owns the graduated v4 position NFT |

Token creation, curve trading, graduation, DEX liquidity, and the locker are separate steps inside `FusedFactory`, not a rewrite of `LaunchFactory.launch()`.

## Curve model: virtual-reserve constant product

Chosen for Pump.fun-like UX: deterministic buys and sells before a DEX exists.

```
k = virtualQuote * virtualToken

buy  (dx quote in):  tokensOut = virtualToken * dx / (virtualQuote + dx)   // floor
sell (dy token in):  quoteOut  = virtualQuote * dy / (virtualToken + dy)   // floor
```

After a buy: `virtualQuote += dx`, `virtualToken -= tokensOut`, `realQuote += dx`, `realToken -= tokensOut`.  
Rounding floors output, so `k` is non-decreasing (favours the pool).

**Price (ETH per token, 1e18 fixed):** `virtualQuote * 1e18 / virtualToken`  
**Market cap:** `priceX18 * circulating / 1e18`  
**FDV:** `priceX18 * totalSupply / 1e18`

These are Fused AI definitions, not an external oracle.

## Parameters (constructor, not compiled “prod constants”)

Local Anvil (small so e2e can graduate):

| Param | Local default |
|-------|----------------|
| `virtualQuote` | 0.05 ETH |
| `virtualToken` | 1_000_000_000e18 |
| `graduationTarget` | 0.1 ETH |
| `feeBps` | 0 |
| `lpFee` (v4 after grad) | 1% (10_000 pips) |

A future public deployment passes larger constructor values. Unsafe local targets must not be hardcoded as the only bytecode constants.

Quote asset this phase: **native ETH only**. Arbitrary ERC-20 quotes are rejected. A later allowlist can add approved quotes.

## Supply

```
totalSupply     = 1_000_000_000e18   (LaunchToken DEFAULT_SUPPLY)
creator alloc   = 0
reward alloc    = 0
curve inventory = 100% at create (held by FusedFactory)
circulating     = tokens sold through buy()
graduation LP   = remaining factory inventory + realQuote ETH
```

Optional `msg.value` on `create()` is a **creator buy through the same math**. No hidden premine.

## Fees

This phase: **0 bps**. No protocol skim, no creator curve fee.

Constructor may set `feeBps` up to **100** (1%) with an immutable `feeRecipient`. There is no owner function to raise fees later. Local deploy uses 0.

MEV / front-running: curve txs use `deadline` + `minOut`. This is **not** MEV protection.

## Graduation

**Trigger (on-chain only):** `realQuote >= graduationTarget`.

`buy()` auto-graduates in the same transaction when the threshold is met. Anyone may also call `graduate(token)` once the threshold is met.

On graduate:

1. State → `GRADUATED` (once).
2. Curve buy/sell stop; further `buy`/`sell` route to Uniswap v4.
3. Remaining tokens + `realQuote` ETH seed a **two-sided** v4 pool at the last curve price.
4. Position NFT is minted to `LaunchLocker` and `register()`ed (fees burned unless recipients were set — this phase burns).
5. Dust burned to `0x…dEaD`.

States: `NONE` (unknown) · `CURVE_ACTIVE` · `GRADUATED`.

## Trading UI routing

| State | BUY / SELL execution |
|-------|----------------------|
| `CURVE_ACTIVE` | `FusedFactory` curve math |
| `GRADUATED` | Same functions, Uniswap v4 swap adapter |

V2/V3 are not implemented.
