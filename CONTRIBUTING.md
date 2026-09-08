# Contributing

Phase 1 is architecture and audit. Product launch mechanics land in later phases.

## Ground rules

- No mock launches, prices, posts, AI drafts, or balances in production paths.
- Unavailable dependencies return typed states (`NOT_CONFIGURED`, `PROVIDER_UNAVAILABLE`, `RPC_UNAVAILABLE`, `DATABASE_UNAVAILABLE`, `CONTRACTS_NOT_DEPLOYED`, `ADAPTER_NOT_IMPLEMENTED`).
- Do not modify `upstream/` contract behavior.
- Do not copy Quiver source into `contracts/src` until `docs/UPSTREAM_AUDIT.md` records a confirmed license.
- AI never holds keys or signs.
- Tokenized assets are identified by `chainId + contractAddress`, never by ticker.

## Tests

```
npm test
cd contracts && forge test --match-path test/unit/DexAvailability.t.sol
cd upstream/openlaunch/contracts && forge test --match-path test/LaunchFactory.t.sol
```
