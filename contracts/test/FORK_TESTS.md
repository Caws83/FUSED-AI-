# Fork / security tests

Copied unmodified from `upstream/openlaunch/contracts/test/`. They skip unless
`FORK_TESTS=true` (visible `[SKIP]`, not silent green).

Do not fake RPC responses. Do not delete these suites to go green.

| File | Needs | Default RPC if unset |
|------|--------|----------------------|
| `fork/LaunchFactory.fork.t.sol` | `FORK_TESTS=true`; public Base RPC | `https://mainnet.base.org` |
| `fork/LaunchFactory.gitlawb.fork.t.sol` | `FORK_TESTS=true`; `BASE_RPC_URL` optional | `https://mainnet.base.org` |
| `fork/LaunchFactory.gitlawbRobinhood.fork.t.sol` | `FORK_TESTS=true`; `ROBINHOOD_RPC_URL` optional | `https://rpc.mainnet.chain.robinhood.com` |
| `fork/LaunchFactory.stock.fork.t.sol` | `FORK_TESTS=true`; `ROBINHOOD_RPC_URL` optional | `https://rpc.mainnet.chain.robinhood.com` |
| `security/LaunchLocker.rug.fork.t.sol` | `FORK_TESTS=true`; `BASE_RPC_URL` optional | `https://mainnet.base.org` |
| `security/LaunchLocker.rug.robinhood.fork.t.sol` | `FORK_TESTS=true`; `ROBINHOOD_RPC_URL` optional | `https://rpc.mainnet.chain.robinhood.com` |

Gitlawb / stock / rug suites bind to **live OpenLaunch factory addresses** on
those chains (ABI-compatible with our unmodified copies). They do not use Fused
AI deployment addresses (none exist yet).

Run locally:

```
FORK_TESTS=true BASE_RPC_URL=... forge test --match-path test/fork -vv
FORK_TESTS=true ROBINHOOD_RPC_URL=... forge test --match-path test/security -vv
```
