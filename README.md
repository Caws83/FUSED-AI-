# Fused AI

**Launch a token from a post.** One post. One click. One token.

Fused AI is a social-first AI token **launch and trading** platform:

FUSE → CURVE → TRADE → GRADUATE → UNISWAP (locked LP)

A public post becomes a launch draft, a human reviews it, and a **wallet** — never an AI process — signs the on-chain transaction. Tokens trade on a bonding curve, then graduate into Uniswap v4 with locked liquidity.

## Current state

Phase 5: Fused bonding-curve factory, real buy/sell, graduation into Uniswap v4, trade/candle indexer, token terminal, HTTP AI drafts when credentials exist.

Not yet: testnet/mainnet deploy, V2/V3. Live X feed needs `X_BEARER_TOKEN`. AI HTTP needs `AI_PROVIDER` + `AI_API_KEY` + `AI_MODEL` (fail closed otherwise).

V4 is **implemented** for graduated tokens. It is **available** when Fused factory/locker addresses are set (local `.env.local` after deploy).

## Architecture

See [docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md) and [docs/BONDING_CURVE_ARCHITECTURE.md](docs/BONDING_CURVE_ARCHITECTURE.md).

```
Post → SocialProvider → AI draft → user review → wallet sign
    → FusedFactory.create → bonding curve buy/sell
    → graduate → Uniswap v4 LP in LaunchLocker
    → indexer (trades + candles) → Explore / token terminal
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

Exact Anvil + deploy + wallet + launch steps: [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md).

| Command | What |
|---------|------|
| `npm run chain` | Anvil at http://127.0.0.1:8545 (chain 31337) |
| `npm run db:up` | Local Postgres |
| `npm run db:migrate` | Apply index schema |
| `npm run contracts:deploy:local` | Uniswap v4 + Fused factory/locker |
| `npm run indexer` | Follow `Launched` events |
| `npm run dev` | Next.js at http://localhost:3000 |
| `npm run dev:local` | Stop stale :3000, then web + indexer |
| `npm run contracts:launch:local` | Real launch via Anvil account #0 |
| `npm run local:reset` | Clear generated local addresses |
| `npm run status` | CLI availability dump |

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

Next: **Phase 5 — AI draft + AI artwork** (still no V2/V3, no testnet).

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
| [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md) | Anvil, deploy, wallet, launch |
| [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) | Every env var |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Package boundaries |
| [docs/SECURITY.md](docs/SECURITY.md) | Keys, untrusted posts |
| [docs/CONTRACTS.md](docs/CONTRACTS.md) | Factory, locker, adapters |
| [docs/UPSTREAM_AUDIT.md](docs/UPSTREAM_AUDIT.md) | OpenLaunch + Quiver provenance |

## License

MIT. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
