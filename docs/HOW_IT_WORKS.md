# How Fused AI works

Fused AI turns a public social post into an onchain token launch. A human always
reviews the draft. A wallet always signs. AI never holds keys.

## User flow

```
X POST
   ↓
SOCIAL PROVIDER          (untrusted input)
   ↓
NORMALIZED POST
   ↓
FUSED AI                 (draft only; fail closed without creds)
   ↓
LAUNCH DRAFT             (schema-validated)
   ↓
USER REVIEW
   ↓
WALLET SIGNATURE         (the user)
   ↓
FUSED FACTORY.create
   ↓
BONDING CURVE            (buy / sell, real reserves)
   ↓
GRADUATION               (on-chain realQuote target)
   ↓
UNISWAP V4 + LOCKER      (two-sided LP, NFT locked)
   ↓
INDEXER                  (Created / Trade / Graduated / Transfer)
   ↓
TOKEN TERMINAL           (chart, trades, BUY / SELL)
```

### What each step means

1. **Post** — Someone publishes on X (or another configured network). The text is untrusted.
2. **Social provider** — Fetches the post. Fail closed if credentials are missing. No mock feed.
3. **Normalized post** — Structured `SocialPost` (author, text, media, metrics, time).
4. **Fused AI** — An `AIProvider` proposes name, ticker, and art when configured. Post text is data, never instructions.
5. **Launch draft** — Schema validation. Invalid output is rejected. AI output is never executed.
6. **Review** — The user sees the form (and origin post if fused) and can edit it.
7. **Sign** — The user’s wallet calls `FusedFactory.create`. The server has no user keys.
8. **Factory** — CREATE2 `LaunchToken`, inventory on the curve. Optional `msg.value` is a creator buy through the same math.
9. **Curve** — Virtual-reserve constant product. Buyers send ETH; sellers return tokens.
10. **Graduation** — When `realQuote >= graduationTarget`, remaining inventory + ETH become locked v4 LP.
11. **Locker** — Holds the position NFT forever. `collect` takes **zero** liquidity (fees only).
12. **Indexer** — Reads Created/Trade/Graduated/Transfer. It does not invent rows, prices, or volume.
13. **Explore / token page** — Real indexed stats, chart, and the same BUY / SELL panel (curve or v4).

## One-click (eventual UX)

Once preferences exist (quote asset, fee, recipients), pasting a post should
pre-fill almost everything. The user still **reviews** and **signs**. That is
one click of confirmation, not a signature-free or gasless launch. The chain
requires a signed transaction from the user’s wallet.

## Hard boundaries

| Actor | May sign |
|-------|----------|
| User wallet | Launch, later swaps, metadata |
| Deployer EOA | Contract deploy scripts only |
| AI | Never |
| API / indexer / social service | Never |

- Social content is untrusted.
- Tokenized assets are allowlisted by **chain id + contract address**, never by ticker alone.
- DEX support is adapter-based. V4 core launches on local Anvil when Fused addresses are set. V2/V3 are not implemented.
- The indexer only follows chain events. No synthetic tokens, prices, or volume.

## Public vs developer

| Surface | Language |
|---------|----------|
| `/`, `/community`, `/launch`, `/rewards`, `/explore` | Product copy. Empty states, never “not configured”. |
| `/status` | Adapter, RPC, database, contracts, registry. No secrets or full keyed URLs. |

## Current honesty

This checkout can run a **local Anvil curve launch**: create, buy, sell, graduate
to Uniswap v4, and index real trades/candles. Fuse a **real X post** when
`X_BEARER_TOKEN` is set. AI drafts run only with `AI_PROVIDER` + `AI_API_KEY` +
`AI_MODEL`. **LIVE X INGESTION NOT SMOKE TESTED** until a bearer token is present.
See [TODO.md](../TODO.md), [TRADING.md](TRADING.md), [AI.md](AI.md).
