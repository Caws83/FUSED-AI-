# Fused AI — master TODO

Checkboxes reflect **this checkout**, not wishes. Do not mark future work complete.

## PHASE 1 — FOUNDATION

- [x] Audit OpenLaunch
- [x] Audit Quiver
- [x] Repository architecture
- [x] Availability / fail-closed packages
- [x] CI foundation

## PHASE 2 — CORE

- [x] Import LaunchFactory
- [x] Import LaunchLocker
- [x] Import LaunchToken
- [x] Contract unit tests
- [x] Fork / rug tests copied (gated on `FORK_TESTS`)
- [x] Frontend shell
- [x] V4 adapter `implemented = true`, `available = false` until Fused addresses exist

## PHASE 2.5 — PRODUCT CLEANUP

- [x] Public UI cleanup
- [x] Fused branding
- [x] Environment strategy
- [x] Environment validation
- [x] Architecture / how-it-works documentation

## PHASE 3 — LOCAL CHAIN

- [x] Start Anvil
- [x] Deploy Fused contracts locally
- [x] Configure local addresses (`LAUNCH_*`, Uniswap local)
- [x] Connect wallet (public chain + public RPC)
- [x] Manual launch form bound to `FusedFactory.create`
- [x] Simulate transaction
- [x] Sign transaction
- [x] Verify locked liquidity
- [x] Index launch (fail closed without DB + RPC + factory)
- [x] Explore + token detail from real events

## PHASE 4 — SOCIAL

- [x] Real X provider (live credential smoke pending)
- [x] Tracked accounts
- [x] Trending scoring
- [x] Post ingestion
- [x] Post validation
- [x] Fuse button on live posts
- [x] Wallet polish + conditional WalletConnect
- [x] Token media upload + local store
- [x] Token metadata + source-post association

## PHASE 5 — AI + BONDING CURVE

Local bonding-curve trading is complete. Live X/AI credentials and public deploys are not.

- [x] Bonding curve (`FusedCurveMath` + `FusedFactory`)
- [x] Buy / sell on the curve
- [x] Trade indexer
- [x] OHLCV charting from indexed trades
- [x] Market cap / FDV from on-chain price × circulating / supply
- [x] Holders from ERC-20 transfers
- [x] Graduation at the on-chain ETH target
- [x] Uniswap v4 migration on graduate
- [x] LP NFT to locker
- [x] Post-graduation swaps through the same buy/sell ABI
- [x] Manual launch independent of X and AI
- [x] AI provider HTTP client (fail-closed without credentials)
- [x] Prompt isolation + schema validation + human review
- [ ] Live X credentials (`X_BEARER_TOKEN`) — provider exists; smoke not run
- [ ] Live AI text provider (`AI_PROVIDER` / `AI_API_KEY`)
- [ ] Live AI image provider (`AI_IMAGE_PROVIDER` / `AI_IMAGE_API_KEY`)

## PHASE 6 — REWARDS

- [ ] Verified asset registry populated (chain + address)
- [ ] Reward architecture
- [ ] Creator rewards
- [ ] Holder rewards
- [ ] Referral rewards
- [ ] Community rewards
- [ ] Tests

## PHASE 7 — DEX

- [x] V4 baseline (in-tree; local Anvil deploy in Phase 3)
- [ ] V3 adapter
- [ ] V2 adapter
- [ ] Integration tests against deployed bytecode

## PHASE 8 — TESTNET

- [ ] Choose test network
- [ ] Deploy Fused factory/locker
- [ ] Verify
- [ ] End-to-end launch
- [ ] Indexer
- [ ] Social
- [ ] AI

## PHASE 9 — PRODUCTION

- [ ] Audit
- [ ] Deployment plan
- [ ] Monitoring
- [ ] Production deployment

## Explicitly not started

Live X credentials (provider implemented; smoke pending), live AI text/image
credentials, tokenized-stock rewards, V2/V3 adapters, Quiver source,
mainnet/testnet deploy of Fused AI.
