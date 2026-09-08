# contracts/lib

`forge-std` is not vendored here. Link it from unmodified OpenLaunch:

Windows:

```
mklink /J lib\forge-std ..\upstream\openlaunch\contracts\lib\forge-std
```

Unix / CI:

```
ln -sfn ../../upstream/openlaunch/contracts/lib/forge-std lib/forge-std
```
