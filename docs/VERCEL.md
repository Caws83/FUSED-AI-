# Vercel — FUSED AI web

This is the public website. It is **Next.js** in `apps/web`.

The existing Vercel project named `fused-ai-api` (https://fused-ai-api.vercel.app/) is **the wrong app**. Live `/`, `/health`, and `/api/health` all return `500 FUNCTION_INVOCATION_FAILED`. That crash shape matches a Node `http.Server` (`apps/api`) or a non-Next monorepo root running as a serverless function — not a healthy Next.js site.

`apps/api` is a local developer HTTP helper (`npm run status`). It is **not** the public website. Do not delete it. Do not deploy it to Vercel.

Do **not** run the blockchain indexer inside Vercel serverless functions.

## Exact dashboard setup

GitHub repo: `Caws83/FUSED-AI-`

1. Open [vercel.com](https://vercel.com) and sign in with GitHub.
2. **Add New → Project** (or open the existing `fused-ai-api` project and change settings below).
3. Import **Caws83/FUSED-AI-**.
4. Framework Preset: **Next.js**
5. Root Directory: **`apps/web`**
6. Turn **ON**: “Include source files outside of the Root Directory in the Build Step”
   (needed so `packages/*` and the repo `package.json` workspaces install).
7. Install Command: `cd ../.. && npm install`
8. Build Command: `cd ../.. && npm run build --workspace=@fused-ai/web`
9. Output: Next.js default (leave blank)
10. Node.js Version: **22.x**
11. Environment variables: start with **none**. The site must render with X, AI, WalletConnect, and public contracts unset.
12. Click **Deploy**.

`apps/web/vercel.json` encodes the install/build commands. `next.config.ts` sets `outputFileTracingRoot` to the repository root so serverless functions include workspace packages.

You may **rename** the Vercel project from `fused-ai-api` to something like `fused-ai`. The name does not matter. The **Root Directory** does.

If the current project’s Root Directory is `apps/api` or the repo root with Framework “Other”, change it to `apps/web` + Next.js as above and Redeploy. Do not create a second architecture just because of the old project name.

## Why Root Directory is `apps/web`

Vercel must see `apps/web/next.config.ts` so it treats the project as Next.js and looks for `apps/web/.next`.

Install still happens from the **repository root** (`cd ../.. && npm install`) because `@fused-ai/web` imports workspace packages (`@fused-ai/config`, `@fused-ai/ui`, …). Installing only inside `apps/web` breaks those links.

## Health check

After deploy, open:

`https://<your-deployment>/api/health`

Expected JSON:

```json
{ "status": "ok", "service": "FUSED AI Web" }
```

This route does not use X, AI, database, or contracts. If this URL 500s, the Vercel project is still the wrong root/app.

`/api/ready` reports whether blockchain, database, media, and the indexer are configured, plus indexer lag. It does not include credentials.

## Minimum env for the first public website

None required. Homepage, Community, Launch (“Launching soon”), Rewards, and Explore must render.

`DATABASE_URL` is **not** required for the shell. Without it, token boards show **Indexing…**. Token detail pages still open from onchain `getMarket` when the factory is configured. Charts/trades/holders need Postgres + the indexer.

Do not set:

- `http://127.0.0.1:8545` or `localhost` RPC
- local Anvil factory `0x9fE467…` / locker `0x755378…`
- `DATABASE_URL` pointing at Docker/localhost Postgres
- `MEDIA_STORE=local`
- `DEPLOYER_PRIVATE_KEY`

Production rejects local RPC, local Postgres, and Anvil CREATE addresses.

For Robinhood **testnet** wallets, copy the public list from `npm run env:testnet` (chain id **46630**). Do not use mainnet 4663.

Hosted **Postgres** (`DATABASE_URL`, server-only) plus a Railway indexer are required for homepage boards, charts, trades, and holders. See `docs/RAILWAY.md`. Token pages can still open from onchain `getMarket` if the indexer is behind.

See `docs/ENV_QUICKSTART.md`.

## Env table

| VARIABLE | REQUIRED NOW? | WHERE TO GET IT | SECRET? | EXAMPLE TYPE |
|----------|---------------|-----------------|---------|--------------|
| **Required for public website** | | | | |
| `NEXT_PUBLIC_APP_URL` | Recommended | Your Vercel URL | no | `https://your-app.vercel.app` |
| **Required when contracts are deployed** | | | | |
| `PUBLIC_CHAIN_CONFIGURED` | then yes | Set `true` yourself | no | `true` |
| `PUBLIC_LAUNCH_ENABLED` | then yes | Set `true` yourself after review | no | `true` |
| `NEXT_PUBLIC_CHAIN_ID` | then yes | Public chain id (not 31337) | no | `46630` testnet / `4663` mainnet later |
| `NEXT_PUBLIC_RPC_URL` | then yes | Public RPC (not localhost) | no | `https://rpc.testnet.chain.robinhood.com` |
| `CHAIN_ID` | then yes | Same as public chain | no | `46630` |
| `RPC_URL` | then yes | Server RPC; keyed URL is a secret | if keyed | same public RPC is fine |
| `LAUNCH_FACTORY_ADDRESS` | after Fused deploy | Overlay default = V2 from `deployments/robinhood-testnet-46630-v2.json` | no | do not invent |
| `LAUNCH_LOCKER_ADDRESS` | after Fused deploy | V2 locker | no | do not invent |
| `LAUNCH_FACTORY_V1_ADDRESS` | keep for legacy tokens | `deployments/robinhood-testnet-46630.json` | no | V1 factory |
| `LAUNCH_LOCKER_V1_ADDRESS` | keep for legacy tokens | same V1 manifest | no | V1 locker |
| `LAUNCH_FACTORY_V2_ADDRESS` | after V2 deploy | V2 manifest | no | V2 factory |
| `LAUNCH_LOCKER_V2_ADDRESS` | after V2 deploy | V2 manifest | no | V2 locker |
| `DEFAULT_LAUNCH_VERSION` | after V2 | `v2` | no | new launches |
| `UNISWAP_POOL_MANAGER_ADDRESS` | overlay | Testnet example JSON (bytecode-verified) | no | do not paste Anvil |
| `UNISWAP_POSITION_MANAGER_ADDRESS` | overlay | Testnet example JSON | no | do not paste Anvil |
| `UNISWAP_PERMIT2_ADDRESS` | overlay | Canonical Permit2 | no | CREATE2 address |
| **Required for DB / indexer** | | | | |
| `DATABASE_URL` | for live tokens | Managed Postgres (Neon, Supabase, RDS, …) | **yes** | `postgres://user:***@host/db` |
| `INDEXER_START_BLOCK` | for indexer | Factory deploy block | no | integer |
| **Optional X** | | | | |
| `SOCIAL_PROVIDER` | no | `x` when you have a token | no | `x` |
| `X_BEARER_TOKEN` | no | X developer portal | **yes** | bearer token |
| **Optional AI** | | | | |
| `AI_PROVIDER` | no | vendor id | no | `openai` |
| `AI_API_KEY` | no | vendor dashboard | **yes** | `sk-…` |
| `AI_MODEL` | no | vendor model name | no | model id |
| `AI_IMAGE_PROVIDER` | no | vendor id | no | `openai` |
| `AI_IMAGE_API_KEY` | no | vendor dashboard | **yes** | `sk-…` |
| **Optional WalletConnect** | | | | |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | no | WalletConnect Cloud | no | project id |
| **Optional production media** | | | | |
| `MEDIA_STORE` | for uploads | `s3` or `r2` | no | `r2` |
| `AWS_ACCESS_KEY_ID` | with object store | bucket credentials | **yes** | access key |
| `AWS_SECRET_ACCESS_KEY` | with object store | bucket credentials | **yes** | secret |
| `BUCKET_NAME` | with object store | bucket name | no | bucket |
| `IMAGE_PUBLIC_BASE` | with object store | public https base | no | `https://cdn…` |
| **Display only** | | | | |
| `NEXT_PUBLIC_GRADUATION_TARGET_USD` | no | product intent `50000` | no | `50000` |
| `STATUS_PAGE_PUBLIC` | no | `1` to show `/status` in production | no | `1` |

Injected browser wallets still work when `NEXT_PUBLIC_CHAIN_ID` + `NEXT_PUBLIC_RPC_URL` are set. WalletConnect is optional.

## First deploy without X / AI / WalletConnect / contracts

Leave those variables empty. You should see product pages, empty boards, and **Launching soon**. That is correct. Do not paste local Anvil addresses to “make launch work” on Vercel.

## After you have managed Postgres (optional)

Set `DATABASE_URL` to the **hosted** URL, not `127.0.0.1`. Run `npm run db:migrate` against that database from a machine you control (or the Railway indexer start command). Vercel request handlers migrate only on `/api/launch/sync`. The indexer migrates on every poll.

## Node version

Repository `engines.node` is `>=22`. Vercel Node.js Version: **22.x**.
