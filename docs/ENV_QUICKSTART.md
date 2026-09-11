# Env quickstart

You only need **root** files. Do not create `apps/web/.env` or `contracts/.env`.

| File | Commit? | What it is |
|------|---------|------------|
| `.env.example` | yes | Template with empty values |
| `.env.local` | no | Written by local Anvil deploy |
| `.env` | no | Extra secrets (deployer key, vendors) |
| `deployments/local-31337.json` | no | Local contract addresses |
| `deployments/robinhood-testnet-46630.example.json` | yes | Testnet template (Fused factory unset) |
| `deployments/robinhood-testnet-46630.json` | after a real testnet deploy | Live testnet addresses |

Addresses come from those JSON files. Do not paste 20 contract addresses by hand.

## Local (Anvil 31337)

```bash
npm run chain
npm run db:up
npm run db:migrate
npm run contracts:deploy:local
npm run dev
```

That writes `deployments/local-31337.json` and `.env.local` (RPC, Postgres, a copy of the addresses). Open http://localhost:3000.

## Robinhood testnet (46630)

1. Put a **real** funded deployer key in **root `.env`** as `DEPLOYER_PRIVATE_KEY`.
2. Do not use the Anvil key from `.env.local`.
3. Run `npm run contracts:deploy:testnet`. If the key is missing or unfunded, it **will not broadcast**.
4. Run `npm run env:testnet` and copy the printed public vars into Vercel.

Chain id **4663 is mainnet**. This repo does not deploy there.

## Vercel (website)

Root Directory must be `apps/web`. See `docs/VERCEL.md`.

Minimum now:

- `NEXT_PUBLIC_APP_URL` = your Vercel URL

When you want wallets on testnet, also set:

- `NEXT_PUBLIC_CHAIN_ID=46630`
- `NEXT_PUBLIC_RPC_URL=https://rpc.testnet.chain.robinhood.com`
- `CHAIN_ID=46630`
- `RPC_URL` = the same public RPC (or a keyed one)

After Fused contracts exist on 46630 and `deployments/robinhood-testnet-46630.json` is `DEPLOYED`, set `PUBLIC_LAUNCH_ENABLED=true`. You should not need to paste Uniswap or factory addresses if that JSON is in the repo.

Do **not** set `DEPLOYER_PRIVATE_KEY`, X tokens, AI keys, AWS secrets, or database passwords unless that service is actually in use.

`/api/health` should return `{ "status": "ok", "service": "FUSED AI Web" }`.

## Optional

| Want | Need |
|------|------|
| Explore / charts / history | Hosted `DATABASE_URL` + indexer process |
| X fuse | `SOCIAL_PROVIDER=x` + `X_BEARER_TOKEN` |
| AI draft / logo | `AI_PROVIDER` + `AI_API_KEY` (and image keys if used) |
| WalletConnect QR | `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` |
| Token image uploads in production | `MEDIA_STORE=s3` or `r2` + bucket credentials |

Manual launch and buy/sell do **not** require X or AI. Missing optional vendors return 503, not 500.
