# Token media

## Chain vs application metadata

`LaunchFactory.launch` takes `metadataURI` (a string). That is **chain data**.
Fused AI does not invent a tokenURI field the contract does not have.

**Application metadata** lives in Postgres `fused_token_metadata`, keyed by
`chainId` + token address:

- description
- image id / public URL
- source platform / post id / author / url / excerpt

That table is not an on-chain guarantee.

## Upload

PNG, JPEG, WEBP only. Magic-byte check, 2 MB max, no SVG. Local store:

```
MEDIA_STORE=local
MEDIA_LOCAL_PATH=.local-data/media
```

Files are served at `/api/media/{id}` in development. They are gitignored.

## Public chains

`assertPublicMediaUrl` rejects `blob:`, `data:`, and localhost URLs unless
`chainId === 31337`. Mainnet launches must use an https object-store URL.

S3/R2 is implemented as an interface. It stays unavailable without real
`AWS_*` + `BUCKET_NAME` + `IMAGE_PUBLIC_BASE`.

## AI images

`AIImageProvider.generateTokenImage` exists and returns unavailable.
No fake artwork. The launch form may show “AI artwork — coming soon”.

## Fallback

If a launch has no uploaded image, Explore and token pages use
`/brand/fused-token.svg` (Fused brand mark). No random generated art.
