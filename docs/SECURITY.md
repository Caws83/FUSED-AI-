# Security

Preserve OpenLaunch's ownerless launch/locker properties unless a later phase
makes a documented, tested change. Do not "merge in" Quiver admin keys by accident.

## Private keys and signing

- User launches are signed in the wallet. Server-side `DEPLOYER_PRIVATE_KEY` is
  for Foundry scripts only.
- AI providers never receive a signing key.
- Indexer and API have no authority to `launch()` for a user.

## Contracts (inherited OpenLaunch assumptions)

- No owner, admin, pause, or upgrade on factory/locker/token.
- Liquidity cannot be withdrawn; rug-fork tests attempt transfer/decrease/burn of the position NFT.
- Recipients fixed at register time; bps must sum to 10_000.
- Reentrancy: locker collect/claim guarded.
- Slippage: Universal Router swaps must keep user-supplied minimums (OpenLaunch trade panel). Do not default to zero min-out in Fused AI.
- MEV / front-running: OpenLaunch has no anti-snipe hook (intentional). Quiver's block-delay is optional future, not a silent add. First-buy in the launch tx can still be raced by others around that block.
- Token validation: do not trust `name()`/`symbol()` for stock identity.
- Uniswap protocol fee (PoolManager owner, capped) cannot pull LP but can skim; document it.

## Quiver-specific (do not inherit blindly)

- Owner can `setDeprecated`, swap hooks/extensions/MEV modules, `claimTeamFees`.
- Fee locker owner controls depositors; Rush owner can `sweep` unclaimed rewards.
- Hook fee lag (N+1 swap) will desync naive indexers.

## Social and AI trust boundary

Treat tweet/post text as **untrusted input**.

- Sanitize URLs (`http`/`https` only); reject `javascript:` and `data:`.
- Strip control characters; clamp length.
- Prompt isolation: post body is JSON data, not concatenated into the system prompt.
- Detect common injection phrases; still require schema validation.
- Malicious content (CSAM, scams, impersonation) is a moderation policy plus
  provider ToS — not something a launch schema can fully solve. Do not auto-launch
  from a post without a human review step in v1.

## Metadata and media

- Re-encode uploads (OpenLaunch uses sharp). Share cards must not fetch user URLs.
- Metadata URIs should be bound to the launching wallet (fix OpenLaunch's unsigned POST).

## Duplicate posts

Index `(platform, postId)` and refuse unbounded repeats until product policy exists.

## API abuse

- Rate limit generation and ingestion.
- Do not proxy arbitrary RPC methods that could drain a funded server wallet (OpenLaunch's `/api/rpc` is a read proxy pattern — keep it read-only).

## Oracles

- Fail closed on stale Chainlink rounds.
- Never display a ticker price as if it were the on-chain quote asset unless the
  allowlisted address matches.

## Upgradeability

Fused AI production contracts should remain non-upgradeable unless a later audit
justifies a proxy — default is OpenLaunch's no-proxy design.
