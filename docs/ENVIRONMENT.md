# Environment

Single source of truth: repository-root `.env.example`.

Copy it to `.env` (gitignored). Next.js loads that root file via `apps/web/next.config.ts`.
Optional override: `apps/web/.env.local` (gitignored).

## Rules

- Public pages must boot without a complete `.env`. Missing values are `not_configured`, never invented.
- Invalid values (bad URL, bad address, non-integer chain id) are listed as `invalid` on `/status`.
- **Server secrets never use `NEXT_PUBLIC_`.** That includes `AI_API_KEY`, `X_BEARER_TOKEN`, `DATABASE_URL`, `DEPLOYER_PRIVATE_KEY`, and keyed `RPC_URL`.
- `NEXT_PUBLIC_RPC_URL` is for the **browser wallet only**. Use a public RPC. If you only have a private RPC key, leave the public variable blank; Connect Wallet stays hidden.
- Do not paste OpenLaunch production factory/locker addresses as Fused AI defaults.

## Loader

`packages/config` is the only place production code should read env:

| Function | Use |
|----------|-----|
| `loadEnv()` | Server: API, indexer, `/status`, contracts availability |
| `loadPublicEnv()` | Browser-safe: `NEXT_PUBLIC_*` only |
| `systemStatus()` | Developer `/status` panel |

Aliases (either name works):

| Preferred | Also accepted |
|-----------|----------------|
| `NEXT_PUBLIC_APP_URL` | `FUSED_SITE_URL` |
| `UNISWAP_POOL_MANAGER_ADDRESS` | `UNISWAP_POOL_MANAGER` |
| `UNISWAP_POSITION_MANAGER_ADDRESS` | `UNISWAP_POSITION_MANAGER` |
| `UNISWAP_UNIVERSAL_ROUTER_ADDRESS` | `UNISWAP_UNIVERSAL_ROUTER` |
| `UNISWAP_PERMIT2_ADDRESS` | `UNISWAP_PERMIT2` |
| `INDEXER_START_BLOCK` | `LAUNCH_DEPLOY_BLOCK` |
| `INDEXER_POLL_INTERVAL` | `INDEXER_INTERVAL_MS` |
| `X_BEARER_TOKEN` | `X_APP_ONLY_TOKEN` |

## Variable catalog

| VARIABLE | SERVICE | SECRET? | REQUIRED? | STATUS | PURPOSE |
|----------|---------|---------|-----------|--------|---------|
| `NODE_ENV` | all | no | no | optional | Node runtime mode |
| `NEXT_PUBLIC_APP_URL` | web | no | no | default localhost | Public site URL |
| `FUSED_SITE_URL` | web / api | no | no | alias | Same as app URL (server) |
| `LOG_LEVEL` | api / indexer | no | no | unused beyond template | Logging verbosity |
| `API_PORT` | api | no | no | default 3001 | HTTP port for `apps/api` |
| `CHAIN_ID` | indexer, contracts, api | no | before chain work | empty | Server chain id |
| `RPC_URL` | indexer, scripts | **yes if keyed** | before chain work | empty | Server RPC. Keep off `NEXT_PUBLIC_*` |
| `RPC_URL_FALLBACK` | indexer | **yes if keyed** | no | empty | Backup RPC |
| `NEXT_PUBLIC_CHAIN_ID` | web wallet | no | to show Connect Wallet | empty | Browser chain id |
| `NEXT_PUBLIC_RPC_URL` | web wallet | no (must be public) | to show Connect Wallet | empty | Browser RPC; never a secret URL |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | web wallet | no | no | empty | WalletConnect Cloud id |
| `WALLETCONNECT_PROJECT_ID` | web | no | no | alias | Same id if not using NEXT_PUBLIC |
| `DEPLOYER_PRIVATE_KEY` | forge scripts | **yes** | deploy only | empty | Contract deploy EOA. Never user launches |
| `LAUNCH_FACTORY_ADDRESS` | web, indexer, adapters | no | before launch | empty | Fused AI factory after **our** deploy |
| `LAUNCH_LOCKER_ADDRESS` | web, indexer | no | before launch | empty | Fused AI locker after **our** deploy |
| `LAUNCH_DEPLOY_BLOCK` | indexer | no | before index | empty | Alias of start block |
| `UNISWAP_POOL_MANAGER_ADDRESS` | launch path | no | before launch | empty | Canonical Uniswap v4 PoolManager |
| `UNISWAP_POSITION_MANAGER_ADDRESS` | launch path | no | before launch | empty | Canonical PositionManager |
| `UNISWAP_UNIVERSAL_ROUTER_ADDRESS` | swaps | no | before swap UI | empty | Canonical Universal Router |
| `UNISWAP_PERMIT2_ADDRESS` | launch path | no | before launch | canonical Permit2 filled | Well-known Permit2 CREATE2 |
| `UNISWAP_STATE_VIEW` | quotes | no | no | empty | v4 StateView |
| `UNISWAP_QUOTER` | quotes | no | no | empty | v4 Quoter |
| `UNISWAP_V3_FACTORY` | v3 adapter later | no | no | empty | Leave blank; V3 not implemented |
| `UNISWAP_V2_FACTORY` | v2 adapter later | no | no | empty | Leave blank; V2 not implemented |
| `DATABASE_URL` | database, indexer, api | **yes** | before persistence | empty | Postgres |
| `INDEXER_START_BLOCK` | indexer | no | before index | empty | First factory block |
| `INDEXER_CONFIRMATIONS` | indexer | no | no | default 2 | Reorg buffer |
| `INDEXER_POLL_INTERVAL` | indexer | no | no | default 15000 | Poll ms |
| `INDEXER_INTERVAL_MS` | indexer | no | no | alias | Same as poll interval |
| `INDEXER_OVERLAP_BLOCKS` | indexer | no | no | default 50 | Rescan overlap |
| `INDEXER_LAG_ALERT_BLOCKS` | indexer | no | no | default 200 | Lag threshold |
| `INDEXER_SYNC_LOOP` | indexer | no | no | 0 | `1` enables loop when implemented |
| `SOCIAL_PROVIDER` | social, web | no | before feed | empty | `x` / `twitter` / … |
| `X_BEARER_TOKEN` | social | **yes** | before X API | empty | X app-only token |
| `X_APP_ONLY_TOKEN` | social | **yes** | no | alias | Same as bearer |
| `X_API_KEY` | social later | **yes** | no | empty | User-context X API |
| `X_API_SECRET` | social later | **yes** | no | empty | User-context X secret |
| `TRACKED_ACCOUNTS_PATH` | social | no | before trending | empty | JSON registry path |
| `TRENDING_*_WEIGHT` | social | no | no | defaults | Ranking weights |
| `AI_PROVIDER` | ai-launch | no | before drafts | empty | Vendor id |
| `AI_API_KEY` | ai-launch | **yes** | before drafts | empty | Vendor secret |
| `AI_API_BASE_URL` | ai-launch | no | no | empty | Optional base URL |
| `AI_MODEL` | ai-launch | no | before drafts | empty | Model name |
| `AI_MAX_OUTPUT_TOKENS` | ai-launch | no | no | 1200 | Cap |
| `AI_TIMEOUT_MS` | ai-launch | no | no | 30000 | HTTP timeout |
| `TOKENIZED_ASSET_REGISTRY_PATH` | blockchain, web | no | before reward assets | empty | Allowlist JSON |
| `IMAGE_STORE` / `MEDIA_STORE` | media | no | local launches | `local` | `local` or `s3`/`r2` |
| `MEDIA_LOCAL_PATH` | media | no | local launches | `.local-data/media` | Gitignored filesystem store |
| `AWS_*` / `BUCKET_NAME` / `IMAGE_PUBLIC_BASE` | images | **yes** (keys) | if S3 | empty | Object storage (inactive without creds) |
| `AI_IMAGE_PROVIDER` | media | no | Phase 5 | empty | No fake generator |
| `ADMIN_WALLETS` | ops later | no | no | empty | Not used for launch authority |
| `PRESENCE_SALT` | ops later | **yes** | no | empty | Unused in Fused AI yet |

## When we populate what

| Phase | Fill |
|-------|------|
| 2.5 | Template only. Local UI runs empty. |
| 3 (done) | Anvil `CHAIN_ID`/`RPC_URL`/`NEXT_PUBLIC_*`, Fused factory/locker after `npm run contracts:deploy:local`, local Postgres `DATABASE_URL` |
| 4 (done) | `SOCIAL_PROVIDER`, `X_BEARER_TOKEN`, `TRACKED_ACCOUNTS_PATH`, `MEDIA_*` |
| 5 | `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_IMAGE_PROVIDER` |
| 6 | `TOKENIZED_ASSET_REGISTRY_PATH` with verified chain+address rows |
| 8+ | Canonical Uniswap addresses for the chosen testnet/mainnet |

## Where values come from

- **Fused factory/locker:** our Foundry deploy. Never OpenLaunch live Base/Robinhood addresses.
- **Uniswap:** official Uniswap deployments for that chain (verify before pasting).
- **Permit2 (local):** official Uniswap precompiled bytecode etched with `anvil_setCode` at the canonical address. Foundry `vm.etch` does not persist on Anvil.
- **Permit2 (public chains):** canonical CREATE2 `0x000000000022D473030F116dDEE9F6B43aC78BA3` on most EVM chains — still confirm.
- **X / AI:** vendor dashboards.
- **Registry:** operator-maintained JSON; identity is chain + contract, not ticker.
