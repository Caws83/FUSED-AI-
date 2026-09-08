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
FUSED AI                 (draft only)
   ↓
LAUNCH DRAFT             (schema-validated)
   ↓
USER REVIEW
   ↓
WALLET SIGNATURE         (the user)
   ↓
LAUNCH FACTORY
   ↓
TOKEN
   ↓
UNISWAP LIQUIDITY        (100% supply, single-sided)
   ↓
LOCKER                   (NFT stays; fees only)
   ↓
INDEXER                  (chain events → database)
   ↓
FUSED AI EXPLORE
```

### What each step means

1. **Post** — Someone publishes on X (or another configured network). The text is untrusted.
2. **Social provider** — Fetches the post. Fail closed if credentials are missing. No mock feed.
3. **Normalized post** — Structured `SocialPost` (author, text, media, metrics, time).
4. **Fused AI (Phase 5)** — An `AIProvider` will propose name, ticker, and art. Today the user types those fields. The post is never trusted as a launch spec.
5. **Launch draft (Phase 5)** — Schema validation. Invalid or injection-looking output is rejected. AI output is never executed.
6. **Review** — The user sees the form (and origin post if fused) and can edit it.
7. **Sign** — The user’s wallet calls `LaunchFactory.launch`. The server has no user keys.
8. **Factory** — CREATE2 token, Uniswap v4 pool, LP minted to the locker. No owner, no platform fee, no upgrade.
9. **Token** — Fixed supply. The only way to obtain it is to buy from the pool.
10. **Liquidity** — Entire supply is locked as a single-sided v4 position.
11. **Locker** — Holds the position NFT forever. `collect` takes **zero** liquidity (fees only).
12. **Indexer** — Reads factory/locker/pool/transfer logs. It does not invent rows.
13. **Explore** — The product board. Empty until real indexed launches exist.

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
| `/`, `/trending`, `/launch`, `/rewards`, `/explore` | Product copy. Empty states, never “not configured”. |
| `/status` | Adapter, RPC, database, contracts, registry. No secrets or full keyed URLs. |

## Current honesty

This checkout can run a **local Anvil launch** and fuse a **real X post** when
`X_BEARER_TOKEN` is set. Users still type name/ticker. Token logos upload to
the local media store. It does **not** call an AI vendor. See [TODO.md](../TODO.md),
[SOCIAL.md](SOCIAL.md), and [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md).
