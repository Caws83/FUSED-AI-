# Social ingestion

Trending is a real ingestion pipeline, not a curated fake feed.

## Registry

Identities such as major finance, crypto news, or public-figure accounts belong
in configuration, **not** in business logic.

```ts
type TrackedAccount = {
  id: string;
  platform: "x" | "twitter" | "mastodon" | "farcaster";
  platformUserId: string;
  username: string;
  displayName: string;
  enabled: boolean;
  category: string;
  priority: number;
  createdAt: string;
  updatedAt: string;
};
```

Load from `TRACKED_ACCOUNTS_PATH` (JSON). The example file is `[]`.
Invalid rows are dropped; duplicates keyed by `platform + platformUserId` are ignored.

## Posts

```ts
type SocialPost = {
  platform; postId; authorId; authorUsername;
  text; url; media; metrics; publishedAt; fetchedAt;
};
```

URLs must be http(s). Text is clamped and treated as untrusted.

## Trending score

Given **real** posts only:

```
score = wV * (engagement / ageHours)
      + wR * exp(-ageHours / 24)
      + wT * log1p(engagement)
```

Weights from env (`TRENDING_*_WEIGHT`, default 0.45 / 0.25 / 0.30).
The scorer never invents posts. An empty registry yields an empty feed, not samples.

## Fail closed

| Condition | State |
|-----------|--------|
| Missing `SOCIAL_PROVIDER` or bearer token or registry path | `NOT_CONFIGURED` |
| Credentials present, live client not implemented (Phase 1) | `PROVIDER_UNAVAILABLE` |
| Provider HTTP error (future) | `PROVIDER_UNAVAILABLE` |

`GET /v1/trending` returns that state with HTTP 503. It does not return demo tweets.

## Duplicate launches

A later phase must key launches by `(platform, postId)` (and/or content hash) so
the same post cannot mint unbounded tokens without an explicit policy. Schema
stub: `fused_launch_drafts` / `fused_launches.source_post_url`.
