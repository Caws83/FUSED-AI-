# Local development — Anvil + real launches

This is the Phase 3 workflow. It uses a **local** chain only. Do not use these
keys or addresses on any public network.

Anvil account #0 is a well-known Foundry test account:

- Address: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
- Private key: `0xac0974bec39a17d36e8e7151ddb29e79448baab2c5c4c87ef57e63cd226c4604`

That key is public in Foundry docs. **Never** import a real wallet key into this
repo. **Never** use the Anvil key on testnet or mainnet.

## 1. Start Anvil

```bash
npm run chain
```

RPC: `http://127.0.0.1:8545`  
Chain id: `31337`

Leave this process running.

## 2. Start local Postgres

Architecture uses Postgres (not SQLite).

```bash
npm run db:up
npm run db:migrate
```

Default URL written into `.env.local`:

`postgres://fused:fused@127.0.0.1:5432/fused_ai`

## 3. Deploy contracts

```bash
npm run contracts:deploy:local
```

This deploys official Uniswap v4 **PoolManager** + **PositionManager**, then
deploys **Fused** `LaunchFactory` (which constructs `LaunchLocker`).

Foundry `vm.etch` does **not** persist Permit2 onto Anvil. The deploy script
writes canonical Permit2 bytecode with `anvil_setCode` at
`0x000000000022D473030F116dDEE9F6B43aC78BA3`. Without that step, `launch()`
reverts.

Universal Router / StateView / Quoter are **not** required for `launch()` and
are not deployed.

It writes gitignored:

- `deployments/local-31337.json`
- `.env.local`

## 4. Import one Anvil account into MetaMask or Rabby

1. Create a new local account (do not use your real wallet).
2. Import the Anvil #0 private key above.
3. Add network:
   - Name: Fused Local
   - RPC: `http://127.0.0.1:8545`
   - Chain id: `31337`
   - Currency: ETH

The account is pre-funded on Anvil.

## 5. Start the indexer

```bash
npm run indexer
```

It reads `Launched` events from `LAUNCH_FACTORY_ADDRESS` on chain `31337` and
writes rows to Postgres. No synthetic launches.

Optional: set `SOCIAL_PROVIDER=x` and `X_BEARER_TOKEN` in `.env` (not
`.env.example`) to fuse real posts. Token logos upload to `.local-data/media`.

## 6. Start the frontend

```bash
npm run dev
```

http://localhost:3000

## 7. Connect wallet

Click **Connect Wallet**. Approve the injected wallet. If you are on the wrong
network, use **Switch Network**.

## 8. Launch a token

Open http://localhost:3000/launch

1. Enter name and ticker.
2. Review.
3. Click **LAUNCH TOKEN**.
4. Sign in the wallet.

Or, without the browser (still a real chain tx with Anvil #0):

```bash
npm run contracts:launch:local
npm run indexer
```

## 9. Inspect Explore

http://localhost:3000/explore should show the indexed token.  
Open `/token/<address>` for chain-backed detail (no fake charts).

## 10. Reset

```bash
npm run local:reset
```

Then stop and restart Anvil (`npm run chain`), deploy again, and optionally:

```bash
docker compose down -v
npm run db:up
npm run db:migrate
```

`local:reset` does not delete source files.

## Commands

| Command | What |
|---------|------|
| `npm run chain` | Anvil 31337 |
| `npm run db:up` | Postgres |
| `npm run db:migrate` | Apply `packages/database/schema.sql` |
| `npm run contracts:deploy:local` | Uniswap v4 + Fused factory |
| `npm run indexer` | Event follower |
| `npm run dev` | Next.js on http://localhost:3000 |
| `npm run dev:local` | Frees stale :3000, then web + indexer via concurrently |
| `npm run contracts:launch:local` | Scripted real launch |
| `npm run contracts:e2e:local` | Simulate + sign + locker checks (Anvil #0) |
| `npm run local:reset` | Drop local addresses |
| `npm run status` | Developer availability JSON |
