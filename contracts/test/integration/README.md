# Integration tests

OpenLaunch does not ship a separate integration suite. Launch → buy → sell →
collect → claim coverage lives in:

- `test/unit/LaunchFactory.t.sol` (local Anvil / in-process Uniswap v4)
- `test/fork/*.fork.t.sol` (live Base / Robinhood Chain, gated by `FORK_TESTS`)

Do not add synthetic integration tests that mock PoolManager behavior.
