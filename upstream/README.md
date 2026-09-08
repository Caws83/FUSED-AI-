# Upstream checkouts

These directories are **reference snapshots**, not Fused AI production code.

| Path | Remote | Commit |
|------|--------|--------|
| `openlaunch/` | https://github.com/Gitlawb/openlaunch.git | `d9e215e11081dc3e33d11ea0fd46348c2f2c78bd` |
| `quiver-contracts/` | https://github.com/quiverfun/quiver-contracts.git | `973c31c49bc73ef3cd3ea3f560b1f75efc811ff3` |

Do not modify contract behavior here. If you need a Fused AI change, implement it
under `/contracts`, `/apps`, `/packages`, or `/services` and record the mapping
in `docs/UPSTREAM_AUDIT.md`.

Initialize (if this tree is cloned as git submodules):

```
git submodule update --init --recursive
```

OpenLaunch Foundry libs are git submodules of OpenLaunch:

```
cd openlaunch
git submodule update --init --recursive
```
