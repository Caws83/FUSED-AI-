# Fused AI

**Launch a token with just 1 click from a tweet.**

Fused AI is a social-first EVM launchpad. A public post becomes structured launch
input, a human reviews it, and a wallet — never an AI process — signs the on-chain
transaction.

This repository is in **Phase 1: audit + foundation**. It is not a reskin of
OpenLaunch and it does not ship mock launches, fake prices, or fake social feeds.

## Status of this checkout

| Subsystem | Phase 1 state |
|-----------|----------------|
| OpenLaunch (reference) | Vendored at `upstream/openlaunch` (MIT, commit pinned in `docs/UPSTREAM_AUDIT.md`) |
| Quiver contracts (reference) | Vendored at `upstream/quiver-contracts` (SPDX MIT claimed; no top-level LICENSE) |
| Fused AI packages | Real TypeScript interfaces, validation, availability states, tests |
| Launch contracts | **Not deployed.** Do not use OpenLaunch live addresses as Fused AI production |
| Social / AI | Return `NOT_CONFIGURED` / `PROVIDER_UNAVAILABLE` without credentials or a live client |
| DEX V2 / V3 | Not implemented; UI must not advertise them |
| DEX V4 | Implemented upstream in OpenLaunch; Fused AI adapter reports not deployed |

## Product flow (target)

```
POST → Social provider → SocialPost
  → AI provider → LaunchDraft → schema validation
  → Launch preview → wallet sign → on-chain launch
```

AI never holds private keys and never submits transactions.

## Quick start

```bash
git clone --recurse-submodules <your-fused-ai-remote>
cd fused-ai
npm install
cp .env.example .env
npm test
```

OpenLaunch unit tests (isolated, unmodified):

```bash
cd upstream/openlaunch/contracts
forge test --match-path test/LaunchFactory.t.sol
```

Fused AI contract interfaces:

```bash
cd contracts
forge test --match-path test/unit/DexAvailability.t.sol
```

## Documentation

| Doc | Contents |
|-----|----------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Boundaries, data flow, why the tree looks like this |
| [docs/UPSTREAM_AUDIT.md](docs/UPSTREAM_AUDIT.md) | OpenLaunch + Quiver inspection, licenses, reuse decisions |
| [docs/CONTRACTS.md](docs/CONTRACTS.md) | Launch, locker, DEX adapters |
| [docs/AI_LAUNCH.md](docs/AI_LAUNCH.md) | Provider abstraction and validation |
| [docs/SOCIAL_INGESTION.md](docs/SOCIAL_INGESTION.md) | Tracked accounts, trending, no mocks |
| [docs/TOKENIZED_STOCKS.md](docs/TOKENIZED_STOCKS.md) | Allowlisted assets, not tickers |
| [docs/SECURITY.md](docs/SECURITY.md) | Keys, untrusted posts, oracles |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Phase 2+ |

## License

MIT. See [LICENSE](LICENSE) and [NOTICE](NOTICE) for upstream attribution.
