# Tokenized stocks / allowlisted assets

Creators may eventually route rewards through **verified** tokenized-stock
contracts where technically and legally available. Phase 1 implements the
registry rules only — no reward streaming.

## Identity rule

An asset is `(chainId, contractAddress)`.

- Issuer, symbol, decimals, oracle, jurisdiction tags are metadata.
- `lookupBySymbol` is defined to **always return null**.
- A random ERC-20 named "AAPL" is not AAPL.

This matches OpenLaunch's practice:

- Base B20: static issuer list + Chainlink feed per **address** (`baseStocks.ts`)
- Robinhood: `api.robinhood.com/rhj/assets` deployments on chain 4663, status active

Fused AI does not copy those allowlists into production config automatically.
They are upstream examples. Our registry file starts as `{ "assets": [] }`.

## Record shape

```
chainId
contractAddress
issuer
symbol
name
decimals
oracle.kind          chainlink | issuer-api | uniswap-twap | none
oracle.feedAddress / feedUrl
oracle.maxAgeSeconds
enabled
jurisdictionsRestricted[]
sourceRegistry
verifiedAt
```

On-chain: `ITokenizedAssetRegistry.isAllowlisted(chainId, contractAddress)`.
The Phase 1 contract has an empty mapping.

## Future reward destinations (interfaces only)

`IRewardSink` destinations: creator, holder, referral, buyback, community.

OpenLaunch already pays LP fees to immutable `LaunchLocker` recipients (or burns).
Quiver adds rotatable reward admins and a separate fee locker.

Fused AI will not implement speculative reward splits in Phase 1. When we do:

- destination asset must be allowlisted
- oracle staleness must fail closed (see OpenLaunch `BASE_STOCK_MAX_FEED_AGE_S`)
- legal/jurisdiction metadata is displayed; the protocol still cannot know the user's location — UI must not imply a US offering of Regulation S instruments

## OpenLaunch quote support (to study in Phase 2)

Factory `LaunchParams.quote` already accepts any ERC-20, including stock tokens,
if salt ordering holds. Pricing is off-chain (Chainlink / issuer API) and must
not be confused with on-chain settlement asset identity.
