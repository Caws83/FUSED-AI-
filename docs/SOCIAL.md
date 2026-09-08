# Social / X

Fused AI reads public posts through a typed `SocialProvider`. The only
implemented provider is X (Twitter API v2).

## Now (Phase 4)

```
X URL or tracked account
  → official API (bearer token)
  → SocialPost
  → /trending or /launch?post={id}
  → user enters name / ticker
  → wallet signs LaunchFactory.launch
```

The user still types the token name and ticker. AI drafts are Phase 5.

## Credentials

```
SOCIAL_PROVIDER=x
X_BEARER_TOKEN=
TRACKED_ACCOUNTS_PATH=config/tracked-accounts.json
```

`X_APP_ONLY_TOKEN` is an alias for the bearer token. No scraping.

Without a bearer token the provider is unavailable. Public pages show an empty
state. `/status` shows the real reason. No mock posts.

## Tracked accounts

Edit `config/tracked-accounts.json` (no code change):

```json
[{ "platform": "x", "username": "example", "category": "crypto", "enabled": true, "priority": 10 }]
```

Usernames are resolved to platform IDs when the API is configured. Do not invent IDs.

## Fuse

Only `https://x.com/{user}/status/{id}` (or twitter.com) is accepted. The server
fetches the real post. Query strings carry a post id, never the post body.
