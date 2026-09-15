# Railway — FUSED AI indexer + Postgres

The public website stays on Vercel (`apps/web`). Railway runs **two** things:

1. **Postgres** — the same database Vercel server routes read
2. **Indexer worker** (`apps/indexer`) — a long-running Node process

Do **not** deploy `apps/web` or `apps/api` to Railway. Do **not** run the indexer on Vercel.

```
Vercel (apps/web)
      |
Railway Postgres
      |
Railway indexer worker (apps/indexer)
      |
Robinhood Testnet RPC 46630
```

The indexer is **read-only**. It does not need `DEPLOYER_PRIVATE_KEY`.

## 1. Create the Postgres database

1. Sign in at [railway.com](https://railway.com).
2. **New project** → **Add Postgres** (or **Database** → **PostgreSQL**).
3. Open the Postgres service → **Variables**.
4. Copy **`DATABASE_URL`**. It looks like `postgres://…` or `postgresql://…`.
   Treat this as a **secret**. Never put it on a `NEXT_PUBLIC_*` key.

Run migrations **once** from this repo (your laptop or the indexer service start command):

```bash
DATABASE_URL="postgres://…" npm run db:migrate
```

That applies `packages/database/schema.sql` with `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` only. It does not drop tables.

## 2. Create the indexer worker

1. In the **same Railway project**, **New service** → **GitHub repo** `Caws83/FUSED-AI-`.
2. **Root directory:** leave **empty** (repository root). This is a npm workspaces monorepo.
3. **Builder:** Nixpacks (default).
4. **Node:** `22` (set `NIXPACKS_NODE_VERSION=22` if Railway picks an older Node).
5. Build command (if asked):

```text
npm install
```

6. Start command:

```text
npm run db:migrate && npm run indexer
```

7. **Restart policy:** On failure / always restart. This is a worker, not an HTTP server.
8. **No public HTTP port.** Health = the process stays running and logs JSON lines like `{"started":true,"fromBlock":"117433209",…}`.

## 3. Indexer environment variables

Paste these on the **indexer service** (not the Postgres service).

Public / safe:

```
CHAIN_ID=46630
RPC_URL=https://rpc.testnet.chain.robinhood.com
INDEXER_START_BLOCK=117433209
INDEXER_SYNC_LOOP=1
INDEXER_CONFIRMATIONS=2
INDEXER_POLL_INTERVAL=15000
INDEXER_OVERLAP_BLOCKS=50
INDEXER_LAG_ALERT_BLOCKS=200
INDEXER_MAX_RANGE_BLOCKS=2000
```

Secret (from the Railway Postgres plugin — **Reference** the variable if both services are in one project):

```
DATABASE_URL=<Railway Postgres URL>
```

Factory and locker **do not need to be pasted** if `CHAIN_ID=46630` is set. Overlays:

From `deployments/robinhood-testnet-46630.json` (legacy V1):

- `LAUNCH_FACTORY_V1_ADDRESS=0x42654079a991EE21e2d2f7Eed0A77bf6a0082208`
- `LAUNCH_LOCKER_V1_ADDRESS=0x68000CD8F3AFE93BB87BeEDc9f2daBbf39E0836b`
- `LAUNCH_V1_DEPLOY_BLOCK=117433209`
- `INDEXER_START_BLOCK=117433209` (earliest; do not raise this to the V2 block)

From `deployments/robinhood-testnet-46630-v2.json` (default V2):

- `LAUNCH_FACTORY_ADDRESS=0x359b3D82d958488eA9177c0F56EB3558ba59a40B`
- `LAUNCH_LOCKER_ADDRESS=0x2De462b0a9A7bB378a8a4E68a352eF30A9250D15`
- `LAUNCH_FACTORY_V2_ADDRESS` / `LAUNCH_LOCKER_V2_ADDRESS` (same)
- `LAUNCH_V2_DEPLOY_BLOCK=119313128`
- `DEFAULT_LAUNCH_VERSION=v2`

You **may** paste those addresses explicitly. Do **not** paste Anvil `0x9fE467…` / `0x755378…`. Do **not** delete the V1 vars.

The indexer polls **both** factories. V1 resumes from the existing per-chain cursor. V2 backfills from block `119313128` using `fused_factory_sync_cursor`. Trades stay unique on `(chain_id, tx_hash, log_index)`.

Treasury `claimFor` is permissionless and is **not** run by this worker. See `docs/ENVIRONMENT.md`.

Optional:

```
RPC_URL_FALLBACK=<another 46630 HTTPS RPC>
```

Do **not** set:

- `DEPLOYER_PRIVATE_KEY`
- `MEDIA_STORE=local`
- `CHAIN_ID=31337` or `4663`
- X / AI keys
- `NEXT_PUBLIC_*` (the indexer does not serve a browser)

## 4. Backfill

The first poll still uses **`INDEXER_START_BLOCK=117433209`** as the V1 floor. Each factory has its own cursor. V2 starts at **`119313128`**. Do not wipe Postgres to pick up V2.

That recovers V1 `Created` / `Trade` / `Graduated` history and V2 events (including **FV2SMOKE**) without typing token addresses.

## 5. Give Vercel the same database

On the Vercel project for https://fused-ai-web.vercel.app :

1. **Settings → Environment Variables**
2. Add **`DATABASE_URL`** = the **same** Railway Postgres URL
3. Environments: Production (and Preview if you use it)
4. **Do not** prefix it with `NEXT_PUBLIC_`
5. Redeploy the website

Until this is set, homepage boards stay empty even though tokens exist onchain. Token **detail** pages can still load from RPC (`getMarket`) so BUY/SELL is not blocked by indexer lag.

## 6. Confirm it is working

Indexer logs should show `started: true` and a `fromBlock` at or after `117433209`.

Then open:

- https://fused-ai-web.vercel.app/api/health → `{ "status": "ok", "service": "FUSED AI Web" }`
- https://fused-ai-web.vercel.app/api/ready → `database: true`, `indexer.indexing: false` after catch-up, `chainId: 46630`

Homepage boards then list real 46630 tokens only. Local Anvil (`31337`) uses Docker Postgres from `.env.local` and is not mixed in.
