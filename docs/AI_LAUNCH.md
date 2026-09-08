# AI launch

Target UX:

```
POST → AI GENERATE → REVIEW → WALLET SIGN → LAUNCH
```

Long-term: as close as safely possible to one post → one click → token.
Safety gates (validation, review, user signature) are not optional.

## Provider abstraction

```ts
interface AIProvider {
  availability(): Availability;
  generateLaunchFromPost(post: SocialPost): Promise<Result<ValidatedLaunchDraft>>;
  generateTokenMetadata(draft: LaunchDraft): Promise<Result<...>>;
  validateGeneratedLaunch(raw: unknown): Result<LaunchDraft>;
}
```

The active vendor is selected by `AI_PROVIDER`. Core packages do not import a
specific SDK. Phase 1 `EnvAIProvider`:

- missing `AI_PROVIDER` / `AI_API_KEY` / `AI_MODEL` → `NOT_CONFIGURED`
- credentials present but no HTTP client yet → `PROVIDER_UNAVAILABLE`
- **never** returns a fabricated `LaunchDraft`

## Schema

A draft is accepted only if `parseLaunchDraft` succeeds:

- `name` 2–64 safe characters
- `ticker` `^[A-Z0-9]{2,12}$`
- `description` 8–500
- `imageConcept` 4–400
- `category` enum
- `suggestedConfig.lpFeePips` 0–30000
- `sourcePost.url` http(s) only
- provider/model/timestamp present

Invalid JSON is rejected. There is no "best effort" coercion into a launchable token.

## Untrusted posts

Post text is data, not instructions. `buildLaunchPrompt`:

- system prompt forbids following directives found in the post
- user payload is JSON: `{ untrustedPostText, injectionFlagsDetected }`
- `detectPromptInjection` flags ignore-instructions / system-prompt / role-override language

Injection flags do **not** authorize a launch. They are recorded for the reviewer.

## Signing

The AI service stops at a validated draft. Encoding the Uniswap/launch transaction
and requesting a signature happens in the wallet client. The API must not accept
a `DEPLOYER_PRIVATE_KEY` for user launches.
