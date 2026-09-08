# Upstream audit

Inspected 2026-09-08. Neither upstream repository was modified for product
behavior. This file is the provenance record.

## OpenLaunch (primary base)

| Field | Value |
|-------|-------|
| Remote | https://github.com/Gitlawb/openlaunch.git |
| Commit | `d9e215e11081dc3e33d11ea0fd46348c2f2c78bd` |
| Date / message | 2026-09-08 · Merge pull request #16 from Gitlawb/feat/gitlawb-quote |
| License | **MIT** — `upstream/openlaunch/LICENSE`, Copyright (c) 2026 openlaunch contributors |
| SPDX | `LaunchFactory.sol`, `LaunchLocker.sol`, `LaunchToken.sol` all `MIT` |
| Layout | `contracts/` (Foundry) + `app/` (Next.js 16) + `.github/workflows/ci.yml` |
| Submodules | `forge-std` `886b4f8b63409ef474542de6394d25a9b5908ed3`; `v4-periphery` `07336f2144f522874e2c3c85e04d1d3f8d5fa471` |

### What it is

Ownerless Uniswap v4 launchpad on Base (8453) and Robinhood Chain (4663):

- `LaunchFactory.launch(LaunchParams)` — CREATE2 token, init v4 pool (`hooks = address(0)`), mint single-sided LP to locker
- `LaunchLocker` — holds position NFT forever; permissionless `collect()`; max 7 recipients; bps sum 10_000; no platform fee
- `LaunchToken` — fixed supply ERC-20 + EIP-2612 permit; no mint/pause/blacklist
- App: wagmi/viem, Postgres indexer (`bb_*` tables), Universal Router swaps, Coinbase B20 + Robinhood stock quote registries (address-based, not ticker-based)

Live OpenLaunch addresses (upstream reference **only**, not Fused AI production):

| Chain | LaunchFactory | LaunchLocker |
|-------|---------------|--------------|
| Base / Robinhood (same addresses) | `0x815542E8b392389A1389E22E588E4B62A67Ade72` | `0xcd1680D26922fcd9CabFbb8a56bA40C333fD842a` |

### Components recommended for **reuse** (later phases, still MIT-attributed)

| Component | Path | Why |
|-----------|------|-----|
| LaunchFactory / Locker / Token | `contracts/src/*.sol` | Ownerless, rug-fork tested, v4-native |
| Unit + rug fork + stock fork tests | `contracts/test/*.t.sol` | Do not drop to go green |
| Indexer + schema | `app/src/lib/launchpad/indexer.ts`, `app/db/schema.sql` | Launch/swap/fee/holder pipeline |
| Universal Router encoding | `app/src/lib/launchpad/swap.ts` | v1 (Base) and v2 (Robinhood `minHopPriceX36`) |
| Stock registries | `baseStocks.ts`, `stocks.ts` | Issuer allowlists + Chainlink / Robinhood API |
| Wallet tx flow | `LaunchForm.tsx` launch path | Simulate then user-sign |
| CI shape | `.github/workflows/ci.yml` | App lint/typecheck/test/build + forge unit |

### Components recommended for **rewrite**

| Area | Why |
|------|-----|
| Launch UX | Form-first; Fused AI is post → AI → review → sign |
| Social discovery | `/feed` is token comments, not tracked public posts |
| AI generation | Does not exist |
| Branding / GITLAWB-centric quotes | Product-specific |
| Metadata POST without signature | Squatting risk; Fused AI should bind meta to the signer |
| In-process indexer inside Next | Split into `apps/indexer` |

### Files reused in Phase 1

- License texts copied to `docs/licenses/`
- Architectural patterns (availability, stock identity, no-owner factory) documented, not copied into `contracts/src`

### Files reused in Phase 2

Production Solidity and tests copied byte-for-byte from OpenLaunch commit `d9e215e11081dc3e33d11ea0fd46348c2f2c78bd`:

| Fused AI path | OpenLaunch upstream path |
|---------------|--------------------------|
| `contracts/src/core/LaunchFactory.sol` | `upstream/openlaunch/contracts/src/LaunchFactory.sol` |
| `contracts/src/core/LaunchLocker.sol` | `upstream/openlaunch/contracts/src/LaunchLocker.sol` |
| `contracts/src/core/LaunchToken.sol` | `upstream/openlaunch/contracts/src/LaunchToken.sol` |
| `contracts/test/unit/LaunchFactory.t.sol` | `upstream/openlaunch/contracts/test/LaunchFactory.t.sol` |
| `contracts/test/fork/LaunchFactory.fork.t.sol` | `upstream/openlaunch/contracts/test/LaunchFactory.fork.t.sol` |
| `contracts/test/fork/LaunchFactory.gitlawb.fork.t.sol` | `upstream/openlaunch/contracts/test/LaunchFactory.gitlawb.fork.t.sol` |
| `contracts/test/fork/LaunchFactory.gitlawbRobinhood.fork.t.sol` | `upstream/openlaunch/contracts/test/LaunchFactory.gitlawbRobinhood.fork.t.sol` |
| `contracts/test/fork/LaunchFactory.stock.fork.t.sol` | `upstream/openlaunch/contracts/test/LaunchFactory.stock.fork.t.sol` |
| `contracts/test/security/LaunchLocker.rug.fork.t.sol` | `upstream/openlaunch/contracts/test/LaunchLocker.rug.fork.t.sol` |
| `contracts/test/security/LaunchLocker.rug.robinhood.fork.t.sol` | `upstream/openlaunch/contracts/test/LaunchLocker.rug.robinhood.fork.t.sol` |

Contract source files were not edited. Tests keep original `src/LaunchFactory.sol` import strings; Foundry remaps those paths to `src/core/`. Uniswap / OZ / Permit2 / Solmate / forge-std are **not** copied into `contracts/src`; remappings point at `upstream/openlaunch/contracts/lib`.

### Files modified in Phase 1

- **None** of the OpenLaunch source of truth.

---

## Quiver contracts (secondary reference)

| Field | Value |
|-------|-------|
| Remote | https://github.com/quiverfun/quiver-contracts.git |
| Commit | `973c31c49bc73ef3cd3ea3f560b1f75efc811ff3` |
| Date / message | 2026-07-15 · Record Quiver Rush distributor deployment (0x56C7...74cE) |
| Top-level LICENSE | **Missing** |
| SPDX | All 61 first-party `src/` `test/` `script/` files sampled: `MIT` |
| README claim | Based on [Clanker v4](https://github.com/clanker-devco/v4-contracts) (MIT, audited by Cantina/Macro — `audits/` **not present** in this checkout) |
| solc | 0.8.28, optimizer 20_000, chain **4663 only** |

### What it is

Admin-gated Uniswap v4 hook launchpad (plus a v3 path):

- `Quiver.sol` — `deprecated = true` until owner activates; module allowlists; `claimTeamFees`
- Hooks skim **30% of LP fee** to protocol (one-swap lag on ERC-6909 claims)
- `QuiverLpLockerMultiple` — up to 7 reward recipients with rotatable admins
- `QuiverFeeLocker` — escrow + anyone-can-`claim`
- MEV: default 2-block delay; sniper auctions exist
- `QuiverRushDistributor` — seasonal merkle WETH rewards
- Robinhood Universal Router ABI includes `minHopPriceX36` (same quirk OpenLaunch documented)

### Worth adapting (patterns only — **do not copy source yet**)

- Guarded activation (`deprecated`)
- Multi-recipient locker + fee escrow
- Fork E2E shape (`LaunchE2E.t.sol`, `ForkSmoke.t.sol`)
- v3 fallback as a future adapter, not a pretend-live mode
- Reward recipient/admin split (creator / buyback / later tokenized-stock sinks)

### Reject / hold

| Item | Reason |
|------|--------|
| Verbatim `src/` | No top-level LICENSE; confirm provenance before redistribution |
| Owner/admin factory | Conflicts with OpenLaunch's no-owner security property we intend to keep |
| 30% protocol skim | Product decision; OpenLaunch is zero platform fee |
| Hardcoded 4663 constants | Only if Fused AI actually deploys there |
| Sniper auctions | Complexity vs first-party test coverage |
| Audit claims | Artifacts not in repo; Quiver has diverged from Clanker |

### Files reused in Phase 1

- None in production contracts.

### Files modified in Phase 1

- None.

---

## License compatibility (working conclusion)

| Source | Can Fused AI ship MIT? |
|--------|------------------------|
| OpenLaunch | Yes, preserve copyright + LICENSE |
| Quiver first-party | **Not until** a LICENSE file or written confirmation exists. SPDX MIT is a strong signal, not a substitute for the required notice. |
| Uniswap v4-core/periphery, Permit2, OZ, forge-std | Keep nested licenses; do not relicense |
| Coss UI / Magic UI (OpenLaunch vendor) | MIT notices already reproduced under `docs/licenses/` |

## Security concerns discovered

See also `docs/SECURITY.md`.

### OpenLaunch

- No owner/upgrade (intentional, verified by rug fork tests). Keep this.
- No anti-snipe hook (documented). First buy can be raced.
- Unsigned `POST /api/launch/meta` — first writer wins `(launcher, meta_key)`.
- Fork/security tests are **not in CI** (need RPC). Do not delete them.
- Uniswap PoolManager owner can set ≤0.1% protocol fee; cannot pull LP.
- Stock feeds: Chainlink 24/5 may be stale up to 5 days; Robinhood prices cached.
- B20 precompiles fail on some RPCs (Alchemy OpcodeNotFound) — needs a capable fallback node.

### Quiver

- Centralized owner/admins can disable launches, swap modules, redirect team fees.
- Protocol fee accounting lags one swap.
- README audits not in tree.
- Locker owner rescue (`withdrawETH` / `withdrawERC20`) — not LP NFT, but still privileged.
- Rush `sweep()` can recover unclaimed rewards.

## Environment gaps (Fused AI)

Required before any live launch path:

- `DATABASE_URL`
- `CHAIN_ID` + `RPC_URL` for the chosen chain
- Canonical Uniswap addresses for that chain (do not guess)
- Fused AI `LAUNCH_FACTORY_ADDRESS` / `LAUNCH_LOCKER_ADDRESS` after **our** deploy
- Social: `SOCIAL_PROVIDER` + `X_BEARER_TOKEN` (or successor) + `TRACKED_ACCOUNTS_PATH`
- AI: `AI_PROVIDER` + `AI_API_KEY` + `AI_MODEL`
- `TOKENIZED_ASSET_REGISTRY_PATH` with verified addresses before any stock rewards
- Image store credentials if not `IMAGE_STORE=local`

OpenLaunch additionally used `BASE_B20_RPC_URL`, `ADMIN_WALLETS`, S3/Tigris keys, and dual-chain factory env vars. Those are not Fused AI production defaults.
