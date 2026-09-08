# Fused AI contracts (Phase 2)

OpenLaunch production core is copied **unmodified** into `src/core/`:

| Fused AI path | OpenLaunch path |
|---------------|-----------------|
| `src/core/LaunchFactory.sol` | `upstream/openlaunch/contracts/src/LaunchFactory.sol` |
| `src/core/LaunchLocker.sol` | `upstream/openlaunch/contracts/src/LaunchLocker.sol` |
| `src/core/LaunchToken.sol` | `upstream/openlaunch/contracts/src/LaunchToken.sol` |

Hashes must match the inspected OpenLaunch commit. Do not add an owner, upgrade
proxy, Quiver admin, or platform fee skim.

Tests (intent preserved; import paths remapped via `remappings.txt`):

| Fused AI path | OpenLaunch path |
|---------------|-----------------|
| `test/unit/LaunchFactory.t.sol` | `contracts/test/LaunchFactory.t.sol` |
| `test/fork/LaunchFactory.fork.t.sol` | `contracts/test/LaunchFactory.fork.t.sol` |
| `test/fork/LaunchFactory.gitlawb.fork.t.sol` | `contracts/test/LaunchFactory.gitlawb.fork.t.sol` |
| `test/fork/LaunchFactory.gitlawbRobinhood.fork.t.sol` | `contracts/test/LaunchFactory.gitlawbRobinhood.fork.t.sol` |
| `test/fork/LaunchFactory.stock.fork.t.sol` | `contracts/test/LaunchFactory.stock.fork.t.sol` |
| `test/security/LaunchLocker.rug.fork.t.sol` | `contracts/test/LaunchLocker.rug.fork.t.sol` |
| `test/security/LaunchLocker.rug.robinhood.fork.t.sol` | `contracts/test/LaunchLocker.rug.robinhood.fork.t.sol` |

```
forge build
forge test --match-path "test/unit/*.t.sol"
```

Fork / rug suites skip unless `FORK_TESTS=true`. See `test/FORK_TESTS.md`.

Uniswap v4 / Permit2 / OZ / Solmate / forge-std stay in
`upstream/openlaunch/contracts/lib` and are referenced by remappings. They are
not copied into `src/`.

V4 adapter: `implemented() == true`, `available() == false` until a Fused AI
deployment sets factory/locker addresses. V2/V3 remain unimplemented.
