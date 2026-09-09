# Graduation

Graduation is decided **on chain**, not by the frontend.

## Trigger

`realQuote >= graduationTarget`

Local Anvil default target: **0.1 ETH** (`FUSED_GRADUATION_TARGET_WEI`). That value is a **local test parameter**. Public networks must pass an explicit native-quote wei amount. There is no fallback to 0.1 ETH.

Product intent for public tokens: about **USD $50,000**. That number is **not** encoded in Solidity. The contract stores ETH/native wei. `NEXT_PUBLIC_GRADUATION_TARGET_USD` is a display estimate only (not a live oracle).

`buy()` auto-graduates in the same transaction when the threshold is met. `graduate(token)` is also permissionless after the threshold.

## What happens

1. State becomes `GRADUATED` once.
2. Curve inventory + `realQuote` ETH seed a two-sided Uniswap v4 pool at the last curve price.
3. The position NFT is minted to `LaunchLocker` and registered (this phase burns fee recipients).
4. Further `buy` / `sell` route to v4. The old curve cannot be drained.
5. Dust token balance is sent to `0x…dEaD`.

## LP security

- Locker is ownerless. Creator cannot withdraw LP.
- Protocol admin cannot withdraw LP (there is no admin on locker).
- Graduation cannot run twice (`AlreadyGraduated` / `NotCurve`).

See [BONDING_CURVE_ARCHITECTURE.md](BONDING_CURVE_ARCHITECTURE.md) and [SECURITY.md](SECURITY.md).
