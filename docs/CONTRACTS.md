# Contracts

Phase 1 does **not** change upstream contract behavior and does **not** deploy.

## Baseline: OpenLaunch (reuse candidate)

Three contracts, solc 0.8.26, Cancun, `via_ir`, optimizer 200.

### LaunchFactory

- `launch(LaunchParams)` deploys `LaunchToken` via CREATE2 (salt scoped to `msg.sender`)
- Initializes Uniswap v4 pool with **no hook**
- Mints one single-sided position: 100% supply, quote is currency0, token currency1
- Native ETH quote (`address(0)`) or ERC-20 (must sort below the launched token; `findSalt()`)
- LP fee 0–3% (`MAX_LP_FEE = 30_000` pips), 100% to recipients or burned
- **No owner, no platform fee, no upgrade, no pause**
- Dust that cannot fit the position is burned to `0x…dEaD`

### LaunchLocker

- Factory-only `register()`
- `collect()` uses `DECREASE_LIQUIDITY` with **zero** liquidity (fees only)
- Push-first payouts; failed ETH push (50k gas) becomes `claimable`
- Recipients immutable; `DEAD` recipient burns that share
- Reentrancy guards on collect/claim

### LaunchToken

- Full supply minted to factory, immediately locked as LP
- EIP-2612 permit
- Immutable `metadataURI`

### Tests to preserve

| File | Role |
|------|------|
| `LaunchFactory.t.sol` | Unit + fuzz |
| `LaunchFactory.fork.t.sol` | Live Base |
| `LaunchFactory.gitlawb*.fork.t.sol` | GITLAWB quotes |
| `LaunchFactory.stock.fork.t.sol` | AAPL-quoted Robinhood launch |
| `LaunchLocker.rug.fork.t.sol` | Adversarial: cannot steal LP on Base |
| `LaunchLocker.rug.robinhood.fork.t.sol` | Same on 4663 |

## Quiver (reference only)

Do not copy into `contracts/src` until license confirmation.

Relevant ideas for a later design review (not Phase 1 implementation):

- Hook-based protocol skim vs OpenLaunch's zero platform fee
- `QuiverFeeLocker` claim model vs OpenLaunch push/credit
- Rotatable reward admins vs OpenLaunch immutable recipients
- `deprecated` guarded activation
- v3 locker path as a future `V3Adapter` **after** contracts exist and pass tests

Trust model conflict: Quiver is owner/admin gated. Fused AI Phase 1 decision is to
**keep OpenLaunch's ownerless factory/locker** as the default security property.
Any protocol fee or admin switch is an explicit later product decision, not a silent merge.

## Fused AI tree (`contracts/`)

| Path | Status |
|------|--------|
| `src/dex/interfaces/IDexAdapter.sol` | Interface |
| `src/dex/v2/V2Adapter.sol` | `available() == false` |
| `src/dex/v3/V3Adapter.sol` | `available() == false` |
| `src/dex/v4/V4Adapter.sol` | `available() == false` until Fused AI deploys |
| `src/interfaces/ITokenizedAssetRegistry.sol` | Interface |
| `src/interfaces/IRewardSink.sol` | Interface only |
| `src/registry/TokenizedAssetRegistry.sol` | Empty allowlist |
| `src/core/` | Reserved for a future OpenLaunch port |

UI rule: never label Uniswap V2/V3/V4 as live unless the corresponding adapter
returns `available()` and tests pass against the deployed bytecode.

## Uniswap addresses

Canonical Uniswap deployments may be documented per chain when we pick a chain.
They are **not** Fused AI contracts. Factory/locker addresses start empty in
`.env.example` on purpose.
