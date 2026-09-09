# Production architecture

FUSED AI is not one Vercel function. The public website is request/response. The indexer is a long-running worker.

```
Vercel Web  (apps/web)
      |
Managed Postgres
      |
Persistent Indexer  (apps/indexer — Railway / Fly / Render / VPS later)
      |
Robinhood RPC
```

Contracts stay off Vercel. This checkout does **not** deploy Robinhood contracts.

## What belongs on Vercel

`apps/web` — Next.js UI plus short API routes:

- `/api/health` — always-on JSON, no X/AI/DB
- `/api/launch/sync` — records a wallet launch tx (needs RPC + DB + factory)
- `/api/token/[address]/live` — reads indexed trades/candles
- `/api/media/upload` — only when object storage is configured
- `/api/ai/*` and `/api/social/fuse` — fail with 503 when those vendors are unset

Routes do not keep a permanent process, do not write `.local-data/media` in production, and do not start the indexer.

## What does not belong on Vercel

| Piece | Path | Why |
|-------|------|-----|
| Public website (wrong) | `apps/api` | Node `listen()` helper for local `/health` and `npm run status`. Future HTTP if needed. **Do not delete. Do not deploy.** |
| Indexer | `apps/indexer` | Polls chain, writes Postgres. Needs a persistent Node process. |
| Social ingestion | `services/social-ingestion` | Long-running if you enable X tracking. |
| Local media | `.local-data/media` | Ephemeral on serverless. Use S3/R2 for public token images. |
| Anvil | `npm run chain` | Local only. |

Possible future indexer hosts: Railway, Fly, Render, a VPS. None is selected or deployed in this phase.

## Database

| Environment | `DATABASE_URL` |
|-------------|----------------|
| Local | Docker Postgres `postgres://fused:fused@127.0.0.1:5432/fused_ai` |
| Production | Managed Postgres you create. Do not invent one in git. |

Public pages render with **no** database (empty boards). Live token terminals need Postgres **and** an indexer filling it.

Production rejects localhost / `127.0.0.1` database URLs.

## Contracts

| Network | Manifest | Status in this checkout |
|---------|----------|-------------------------|
| Local Anvil 31337 | `deployments/local-31337.json` (gitignored, written by `npm run contracts:deploy:local`) | Real local addresses |
| Robinhood 4663 | `deployments/robinhood-4663.json` when you deploy; example is `robinhood-4663.example.json` | **NOT DEPLOYED** |

Do not copy Anvil addresses (`0x9fE467…`, `0x755378…`, `0x5FbDB2…`, `0xe7f172…`) onto a public chain. Production config rejects them when `NODE_ENV=production` or the chain id is not 31337.

Canonical Permit2 `0x000000000022D473030F116dDEE9F6B43aC78BA3` is **not** an Anvil-only address.

## Bonding curve (native units, not USD in Solidity)

Local Anvil (test only):

- virtualQuote = 0.05 ETH
- virtualToken = 1B tokens
- graduationTarget = **0.1 ETH**
- feeBps = 0
- lpFee = 10000

Product intent for public Fused tokens: about **USD $50,000** at graduation.

The contract stores a **native quote amount** (wei). There is no ETH/USD oracle in this phase. A public deploy must set `FUSED_GRADUATION_TARGET_WEI` explicitly. Missing values do **not** fall back to 0.1 ETH.

`NEXT_PUBLIC_GRADUATION_TARGET_USD=50000` is a **display estimate** only. The token page labels it as not a live price.

Production fees: set `FUSED_FEE_BPS` and `FUSED_LP_FEE` explicitly when you deploy. No hidden production fee defaults. Local 0 bps stays local until reviewed.

## Feature flags

| Flag | Production default | Meaning |
|------|--------------------|---------|
| `PUBLIC_CHAIN_CONFIGURED` | false | Browser is aimed at a public chain (not 31337) |
| `PUBLIC_LAUNCH_ENABLED` | false | Create / buy / sell are allowed |
| `STATUS_PAGE_PUBLIC` | false | `/status` visible on the public site |

Until public contracts exist, Launch shows **Launching soon**.

## Media

`MEDIA_STORE=local` is Anvil-only. Production treats local filesystem media as not configured. Uploads return unavailable until S3/R2 credentials exist. The website can still deploy.

## Local source of truth

```
npm run contracts:deploy:local
        ↓
deployments/local-31337.json
        ↓
packages/config merge on chain 31337
        ↓
header / launch / trade / status / indexer / scripts
```

`.env.local` is generated from the same deploy for RPC, Postgres, and a copy of those addresses. Do not hand-edit 20 addresses. Do not put those addresses in `.env.example`.

## Public source of truth (future)

```
deployments/robinhood-4663.json
status: DEPLOYED only after a real reviewed deploy
```

Until that file exists with real addresses, production says **NOT DEPLOYED**.
