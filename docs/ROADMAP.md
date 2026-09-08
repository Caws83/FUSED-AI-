# Roadmap

## Phase 1 — DONE

- Audit OpenLaunch + Quiver
- Isolate upstream
- Packages, env, availability states, docs, CI stubs
- OpenLaunch unit tests still runnable in place

## Phase 2 (this checkout) — DONE when the local review is accepted

- Copy unmodified OpenLaunch `LaunchFactory` / `LaunchLocker` / `LaunchToken` into `contracts/src/core/`
- Copy unit + fork + rug tests; unit tests pass in `contracts/`
- V4 adapter `implemented = true`, `available = false` until Fused AI addresses exist
- Production frontend shell in `apps/web` with honest empty states
- **Stop. Do not start Phase 3 in the same pass.**

## Phase 3 — Indexer + wallet launch (recommended next)

Exact next task:

1. Port OpenLaunch indexer + Postgres schema into `apps/indexer` / `packages/database` (keep event semantics; rename `bb_*` if desired).
2. Fail closed without `DATABASE_URL`, `RPC_URL`, `CHAIN_ID`, and Fused AI factory/locker addresses.
3. Wire wagmi `launch()` from `/launch` using **reviewed manual fields** against a local Anvil or a chosen test chain — still no AI HTTP and no X polling.
4. Only after a **Fused AI** factory/locker is deployed to that local/test chain, set `LAUNCH_FACTORY_ADDRESS` / `LAUNCH_LOCKER_ADDRESS` so the V4 adapter can become `available`.
5. Do not default to OpenLaunch production addresses on Base / Robinhood.

## Phase 4 — Social ingestion

- Real X (or approved) API client
- Tracked account registry UI/config
- Trending page backed only by fetched posts

## Phase 5 — AI generation

- Vendor client behind `AIProvider`
- Schema validation + review screen
- Prompt-injection tests with fixtures

## Phase 6 — Tokenized-stock registry (quotes first, rewards later)

- Populate allowlist from issuer sources (re-verify addresses)
- Optional quote asset in `LaunchParams.quote`
- Reward sinks remain unimplemented until legal + contract design lands

## Phase 7 — Optional Quiver patterns (license-cleared)

- Only after LICENSE confirmation
- Evaluate fee locker / guarded deploy / v3 adapter as **opt-in**
- Reject ownerful factory unless product explicitly wants an admin
