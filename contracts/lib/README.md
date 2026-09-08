# contracts/lib

Forge dependencies are **not vendored** here. `remappings.txt` (no comments —
Foundry rejects `#` lines) points at unmodified OpenLaunch submodules:

`../upstream/openlaunch/contracts/lib/{forge-std,v4-periphery}`

`v4-core`, Permit2, Solmate, and OpenZeppelin are nested under `v4-periphery`.

Do not copy those trees into `contracts/src`.
