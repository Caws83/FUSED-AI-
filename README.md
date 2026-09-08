# Fused AI

**Launch a token from a post.** One post. One click. One token.

Fused AI is a social-first EVM launchpad. A public post becomes structured launch
input, a human reviews it, and a wallet — never an AI process — signs the on-chain
transaction.

This repository is in **Phase 2: OpenLaunch core in-tree + local UI shell**.
It does not ship mock launches, fake prices, or fake social feeds.

## Status of this checkout

| Subsystem | Phase 2 state |
|-----------|----------------|
| OpenLaunch core | Copied unmodified into `contracts/src/core/` (MIT, see `NOTICE`) |
| Quiver contracts (reference) | Vendored at `upstream/quiver-contracts` (no top-level LICENSE; not copied) |
| Fused AI packages | Types, validation, availability, UI primitives |
| Launch contracts | **Implemented, not deployed.** Do not use OpenLaunch live addresses |
| Social / AI | Return `NOT_CONFIGURED` / `PROVIDER_UNAVAILABLE` without a live client |
| DEX V2 / V3 | Planned; UI must not advertise them as live |
| DEX V4 | `implemented = true`, `available = false` until Fused AI addresses exist |

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
npm run dev
```

Local UI: http://localhost:3000

```bash
npm test
npm run typecheck
npm run build
```

Contracts:

```bash
cd contracts
forge build
forge test --match-path "test/unit/*.t.sol"
```

Fork / rug tests need `FORK_TESTS=true` and a real RPC. See `contracts/test/FORK_TESTS.md`.

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
| [docs/ROADMAP.md](docs/ROADMAP.md) | Phase 3+ |

## License

MIT. See [LICENSE](LICENSE) and [NOTICE](NOTICE) for upstream attribution.
