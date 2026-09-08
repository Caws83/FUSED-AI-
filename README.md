# Fused AI

**Launch a token from a post.** One post. One click. One token.

Fused AI is a social-first EVM launchpad. A public post becomes a launch draft,
a human reviews it, and a **wallet** — never an AI process — signs the on-chain
transaction.

## Current state

Phase 2.5: OpenLaunch core is in `contracts/src/core/`, the public UI is a
product shell (no developer-console copy), branding and env strategy exist.

Not yet: local Anvil deploy, X API, AI HTTP, V2/V3, testnet.

V4 is **implemented** in-tree and **not available** until Fused AI factory/locker
addresses are set. V2/V3 are planned. Public pages do not advertise adapter flags.

## Architecture

See [docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md) for the end-to-end flow.

```
Post → SocialProvider → AI draft → user review → wallet sign
    → LaunchFactory → token + locked Uniswap v4 LP → indexer → Explore
```

| Process | Path |
|---------|------|
| Web | `apps/web` |
| API | `apps/api` |
| Indexer | `apps/indexer` |
| Social | `services/social-ingestion` |
| AI | `services/ai-launch` |
| Contracts | `contracts/` |

Public routes (`/`, `/trending`, `/launch`, `/rewards`, `/explore`) use product
language. `/status` is the developer panel.

## Quick start

```bash
git clone --recurse-submodules <your-fused-ai-remote>
cd fused-ai
npm install
cp .env.example .env
npm run dev
```

Local UI: http://localhost:3000

## Environment

All variables are documented in [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md).
Template: [`.env.example`](.env.example). Secrets stay gitignored (`.env`, `.env.local`).

Never put `AI_API_KEY`, `X_BEARER_TOKEN`, `DATABASE_URL`, or a keyed RPC on
`NEXT_PUBLIC_*`.

## Contracts

Unmodified OpenLaunch `LaunchFactory` / `LaunchLocker` / `LaunchToken` live in
`contracts/src/core/`. MIT attribution: [NOTICE](NOTICE).

```bash
cd contracts
forge build
forge test --match-path "test/unit/*.t.sol"
```

Fork/rug suites: `FORK_TESTS=true` and a real RPC. See `contracts/test/FORK_TESTS.md`.

## Tests

```bash
npm test
npm run typecheck
npm run build
```

## Local development

| Command | What |
|---------|------|
| `npm run dev` | Next.js at http://localhost:3000 |
| `npm run build` | Production web build |
| `npm run status` | CLI availability dump |
| `apps/api` `npm start` | JSON API (port 3001) |

Do not deploy Fused AI contracts until Phase 3 (local Anvil).

## Project structure

```
apps/web            Product UI + /status
apps/api            Availability HTTP
apps/indexer        Chain follower (fail closed)
packages/*          types, config, social, ai, blockchain, ui, …
contracts/src/core  LaunchFactory, LaunchLocker, LaunchToken
upstream/           Unmodified OpenLaunch + Quiver snapshots
docs/               How it works, env, security, contracts, audit
```

## Roadmap

Master checklist: [TODO.md](TODO.md).

Next: **Phase 3 — local Anvil deploy + real manual token launch.**

## Security principles

- AI never signs. Server never holds user keys.
- Social posts are untrusted.
- Tokenized assets: chain + contract, not ticker.
- Ownerless factory/locker. No silent Quiver admin merge.
- Details: [docs/SECURITY.md](docs/SECURITY.md)

## Docs

| Doc | Contents |
|-----|----------|
| [TODO.md](TODO.md) | Implementation checklist |
| [docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md) | End-to-end product flow |
| [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) | Every env var |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Package boundaries |
| [docs/SECURITY.md](docs/SECURITY.md) | Keys, untrusted posts |
| [docs/CONTRACTS.md](docs/CONTRACTS.md) | Factory, locker, adapters |
| [docs/UPSTREAM_AUDIT.md](docs/UPSTREAM_AUDIT.md) | OpenLaunch + Quiver provenance |

## License

MIT. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
