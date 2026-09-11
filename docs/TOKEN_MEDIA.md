# Token media

## Chain vs application metadata

`FusedFactory.create` takes `metadataURI` (a string). That is **chain data**.
Fused AI does not invent a tokenURI field the contract does not have.

**Application metadata** lives in Postgres `fused_token_metadata`, keyed by
`chainId` + token address:

- description
- image id / public URL
- source platform / post id / author / url / excerpt

That table is not an on-chain guarantee. If the logo write fails after a
successful create transaction, the token still exists onchain. The indexer
discovers it from `Created`. Metadata can be attached later.

## Upload

PNG, JPEG, WEBP only. Magic-byte check, 2 MB max, no SVG, no path traversal.

Local Anvil:

```
MEDIA_STORE=local
MEDIA_LOCAL_PATH=.local-data/media
```

Files are served at `/api/media/{id}` in development. They are gitignored.
`MEDIA_STORE=local` is rejected in production.

## Public chains (Cloudflare R2 or S3)

Production uses the existing S3-compatible adapter (`ObjectMediaStore`).
Do **not** invent new variable names. Do **not** store uploads on the Vercel filesystem.

| Variable | Secret? | Example |
|----------|---------|---------|
| `MEDIA_STORE` | no | `r2` (or `s3`) |
| `AWS_ACCESS_KEY_ID` | **yes** | R2/S3 access key |
| `AWS_SECRET_ACCESS_KEY` | **yes** | R2/S3 secret |
| `AWS_ENDPOINT_URL_S3` | no | `https://<accountid>.r2.cloudflarestorage.com` |
| `AWS_REGION` | no | `auto` for R2 |
| `BUCKET_NAME` | no | bucket name |
| `IMAGE_PUBLIC_BASE` | no | public HTTPS origin, no trailing slash |
| `MEDIA_PUBLIC_BASE` | no | alias for `IMAGE_PUBLIC_BASE` |

Never prefix these secrets with `NEXT_PUBLIC_`.

`assertPublicMediaUrl` rejects `blob:`, `data:`, localhost, and `/api/media/…`
unless `chainId === 31337`. Public launches store an `https://` object URL.

### Cloudflare R2 (beginner)

1. Cloudflare dashboard → **R2 Object Storage** → **Create bucket** (e.g. `fused-media`).
2. Enable **public access** for that bucket (R2.dev subdomain or a custom domain).
3. **Manage R2 API Tokens** → **Create API token** with Object Read & Write on that bucket.
4. Copy **Access Key ID** and **Secret Access Key**.
5. Copy the S3 API endpoint: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
6. `IMAGE_PUBLIC_BASE` is the **public** URL, e.g. `https://pub-xxxxx.r2.dev` (no trailing slash). Not the S3 endpoint.
7. Paste the variables above into **Vercel** (Production). Redeploy.
8. Do **not** paste these into Railway unless the indexer starts uploading images (it does not).

Until these exist, `/api/media/upload` returns `Upload is temporarily unavailable.` Manual launch still works without a logo.

## AI images

`AIImageProvider.generateTokenImage` exists and returns unavailable.
No fake artwork. AI is not part of this phase.

## Fallback

If a launch has no uploaded image, Explore and token pages use
`/brand/fused-token.svg` (Fused brand mark). No random generated art.
