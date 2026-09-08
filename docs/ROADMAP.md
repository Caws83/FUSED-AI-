# Roadmap

## Phase 1 (this checkout) — DONE when the foundation report is accepted

- Audit OpenLaunch + Quiver
- Isolate upstream
- Packages, env, availability states, docs, CI stubs
- OpenLaunch unit tests still runnable in place
- **Stop**

## Phase 2 — Port OpenLaunch launch path without reskinning

Recommended next task (exact):

1. Copy OpenLaunch `LaunchFactory`, `LaunchLocker`, `LaunchToken` **unmodified**
   into `contracts/src/core/` with MIT headers and NOTICE updates.
2. Copy their Foundry tests (unit + keep fork/rug tests behind `FORK_TESTS`).
3. Wire `@fused-ai/blockchain` V4 adapter `implemented() = true` only after
   `forge test --match-path` of those unit tests passes in `contracts/`.
4. Still leave `available() = false` until a Fused AI deployment address is set
   in env (do not default to OpenLaunch's live factory).

Do not start UI launch forms, AI vendor HTTP, or social polling in the same phase
if it would slip mock data into the app.

## Phase 3 — Indexer + wallet launch

- Port indexer/schema (rename `bb_*` if desired, keep event semantics)
- Wallet connect + `launch()` from a **reviewed** draft (still manual fields OK)
- RPC fail-closed

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
