# Fused AI contracts (Phase 1)

This tree holds Fused AI interfaces and honest availability adapters.

Production launch contracts are **not copied here yet**. The unmodified OpenLaunch
implementation remains at:

`upstream/openlaunch/contracts/src/{LaunchFactory,LaunchLocker,LaunchToken}.sol`

Do not point Fused AI env vars at OpenLaunch live addresses.

Quiver source is a reference only (`upstream/quiver-contracts`). Do not copy it
into `src/` until license provenance is confirmed (see `docs/UPSTREAM_AUDIT.md`).

```
forge test --match-path test/unit/DexAvailability.t.sol
```

OpenLaunch unit tests (do not skip):

```
cd ../upstream/openlaunch/contracts
forge test --match-path test/LaunchFactory.t.sol
```
