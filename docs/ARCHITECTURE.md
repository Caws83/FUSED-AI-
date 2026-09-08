# Architecture

Fused AI is a social-first EVM launchpad. Phase 1 establishes boundaries and
unmodified upstream references. It does not implement launch mechanics.

## Why this tree differs slightly from the proposal

The proposed layout is preserved. Two adjustments:

1. **`upstream/` is a snapshot/submodule boundary, not merged source.** OpenLaunch
   and Quiver stay intact so we can always identify original files. Fused AI code
   lives under `apps/`, `packages/`, `services/`, and `contracts/`.
2. **`packages/ui` is empty on purpose.** Shipping launchpad chrome before
   contracts, social, and AI are real would look finished and be fake. `apps/web`
   is an availability console, not a token board.

OpenLaunch's app is a combined Next.js site + API routes + in-process indexer.
Fused AI splits those concerns now so they can scale independently:

| Process | Path | Owns |
|---------|------|------|
| Web | `apps/web` | Status UI, later the POST → REVIEW → SIGN flow |
| API | `apps/api` | JSON availability + future launch/social/AI HTTP |
| Indexer | `apps/indexer` | Chain event follow (refuses to start without RPC + DB + factory) |
| Social ingestion | `services/social-ingestion` | Tracked accounts → normalized posts |
| AI launch | `services/ai-launch` | Draft generation behind `AIProvider` |
| Contracts | `contracts/` | Fused AI interfaces; OpenLaunch src stays upstream |

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

`DexAdapter` exists for v2, v3, and v4. Only an adapter whose contracts exist
*and* whose Fused AI addresses are configured may report `available`. Today none
do. OpenLaunch's v4 factory is the implementation we intend to adopt later; it
is not advertised as a Fused AI deployment.

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
| `@fused-ai/ui` | Reserved |
