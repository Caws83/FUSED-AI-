# Architecture

Fused AI is a social-first EVM launchpad. Phase 2 imports unmodified OpenLaunch
core contracts and ships a local frontend shell. It does not deploy, poll X,
call AI vendors, or invent market data.

## Why this tree differs slightly from the proposal

The proposed layout is preserved. Two adjustments:

1. **`upstream/` is a snapshot/submodule boundary, not merged source.** OpenLaunch
   and Quiver stay intact so we can always identify original files. Fused AI code
   lives under `apps/`, `packages/`, `services/`, and `contracts/`. OpenLaunch
   core is **copied** into `contracts/src/core/` (MIT, unmodified).
2. **`packages/ui` holds production primitives** used by `apps/web`. Empty
   states are required whenever social, indexer, registry, or wallet config is
   missing. No mock tweets, launches, or balances in production routes.

OpenLaunch's app is a combined Next.js site + API routes + in-process indexer.
Fused AI splits those concerns now so they can scale independently:

| Process | Path | Owns |
|---------|------|------|
| Web | `apps/web` | Launchpad UI; POST → REVIEW → SIGN is explained, not executed |
| API | `apps/api` | JSON availability + future launch/social/AI HTTP |
| Indexer | `apps/indexer` | Chain event follow (refuses to start without RPC + DB + factory) |
| Social ingestion | `services/social-ingestion` | Tracked accounts → normalized posts |
| AI launch | `services/ai-launch` | Draft generation behind `AIProvider` |
| Contracts | `contracts/` | OpenLaunch core in `src/core/` plus Fused AI adapters |

## Data flow (target)

```
TrackedAccount registry (config, not hardcoded celebrities)
        │
        ▼
SocialProvider.getPost / trending
        │  (fail closed: NOT_CONFIGURED / PROVIDER_UNAVAILABLE)
        ▼
normalized SocialPost          ← untrusted input
        │
        ▼
AIProvider.generateLaunchFromPost
        │  (prompt wraps post as JSON data; injection flags recorded)
        ▼
unknown JSON
        │
        ▼
parseLaunchDraft (schema)      ← AI output is never trusted
        │
        ▼
LaunchDraft + Launch Preview
        │
        ▼
user wallet signs LaunchFactory.launch
        │  (server has no user keys)
        ▼
on-chain token + locked LP
        │
        ▼
indexer (factory / locker / pool swap / transfer logs)
```

## Availability policy

Production code returns one of:

- `OK`
- `NOT_CONFIGURED`
- `PROVIDER_UNAVAILABLE`
- `RPC_UNAVAILABLE`
- `DATABASE_UNAVAILABLE`
- `CONTRACTS_NOT_DEPLOYED`
- `ADAPTER_NOT_IMPLEMENTED`

Tests may use fixtures under `**/test/**`. Production paths may not silently
substitute mocks.

## DEX

`DexAdapter` exists for v2, v3, and v4. V4 core is implemented in
`contracts/src/core` (`implemented = true`). It still reports `available = false`
until Fused AI factory/locker addresses exist in env. V2 and V3 remain
unimplemented. Do not advertise them as live.

## Signing boundary

| Actor | May sign |
|-------|----------|
| User wallet | Launch, swap, metadata edit, posts |
| Deployer EOA | Contract deploy scripts only |
| AI provider | Never |
| API / indexer | Never (no user keys) |

## Packages

| Package | Role |
|---------|------|
| `@fused-ai/types` | Shared types and availability states |
| `@fused-ai/shared` | Result type, sanitization |
| `@fused-ai/validation` | Launch drafts, posts, tokenized assets |
| `@fused-ai/config` | Env loading; no invented addresses |
| `@fused-ai/social` | SocialProvider + tracked account registry + trending math |
| `@fused-ai/ai` | AIProvider + prompt isolation + schema validation |
| `@fused-ai/blockchain` | Dex adapters + asset registry loader |
| `@fused-ai/database` | Schema + fail-closed client |
| `@fused-ai/ui` | Production primitives (Button, cards, empty states, wallet chip) |
