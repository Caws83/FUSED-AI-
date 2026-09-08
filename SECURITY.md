# Security policy

Report privately. Do not file a public issue for exploitable findings.

Until a Fused AI security inbox is published, treat this repository as pre-production
and do not deploy with real funds.

Inherited OpenLaunch reporting channel (upstream only): see
`upstream/openlaunch/SECURITY.md` (security@gitlawb.com / GitHub private reporting).

## What matters most

1. Liquidity leaving a locker, or fees going to anyone other than launch recipients.
2. AI or a server signing a user launch.
3. Untrusted post text influencing system prompts or bypassing launch validation.
4. A ticker/name being treated as a tokenized-stock identity.
5. UI showing DEX modes, prices, or trending posts that are not backed by real adapters/data.

Full notes: [docs/SECURITY.md](docs/SECURITY.md).
