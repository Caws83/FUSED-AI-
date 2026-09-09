# AI

Fused AI drafts a token from a **normalized social post**. The model never signs, never picks contract addresses, and never bypasses review.

```
SocialPost (untrusted data)
    → HTTP chat/completions (fail closed)
    → schema parseLaunchDraft
    → user edits
    → wallet signs FusedFactory.create
```

## Env

| Variable | Role |
|----------|------|
| `AI_PROVIDER` | Vendor id (e.g. `openai`) |
| `AI_API_KEY` | Secret. Never `NEXT_PUBLIC_*` |
| `AI_MODEL` | Model name |
| `AI_API_BASE_URL` | Optional. Default `https://api.openai.com/v1` |
| `AI_MAX_OUTPUT_TOKENS` | Default 1200 |
| `AI_TIMEOUT_MS` | Default 30000 |
| `AI_IMAGE_PROVIDER` | Optional image vendor |
| `AI_IMAGE_API_KEY` | Optional; falls back to `AI_API_KEY` |

Missing provider/key/model → `NOT_CONFIGURED`. HTTP/schema failure → no draft. **No fake AI.**

## Prompt isolation

Post text is JSON data (`untrustedPostText`). Injection phrases (ignore instructions, reveal API key, change contract, send funds) are flagged and shown as review issues. They are not obeyed.

`model`, `provider`, `generatedAt`, and `sourcePost` are attached **server-side** before schema validation.

## Images

If image credentials exist, `/api/ai/image` calls the images API, requires **b64_json** (no remote URL fetch), then `validateImage` + MediaStore. Otherwise the UI reports artwork temporarily unavailable.

See also [AI_LAUNCH.md](AI_LAUNCH.md).
