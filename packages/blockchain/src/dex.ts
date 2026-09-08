import type { Availability, DexAdapterInfo, DexVersion } from "@fused-ai/types";
import { adapterNotImplemented, AVAILABILITY_STATUS } from "@fused-ai/types";
import type { FusedEnv } from "@fused-ai/config";
import { launchContractsAvailability } from "@fused-ai/config";

export type DexAdapter = {
  readonly version: DexVersion;
  info(): DexAdapterInfo;
  availability(): Availability;
};

class UnimplementedAdapter implements DexAdapter {
  readonly version: DexVersion;
  constructor(version: DexVersion) {
    this.version = version;
  }
  info(): DexAdapterInfo {
    return {
      version: this.version,
      implemented: false,
      available: false,
      reason: `Uniswap ${this.version} adapter has no Fused AI contracts in this checkout.`,
    };
  }
  availability(): Availability {
    return adapterNotImplemented(`Uniswap ${this.version}`);
  }
}

/**
 * V4 is implemented by unmodified OpenLaunch core contracts in contracts/src/core.
 * Production UI must not treat it as live until Fused AI factory/locker addresses
 * are set in env. Do not default to OpenLaunch's deployed addresses.
 */
class OpenLaunchV4Adapter implements DexAdapter {
  readonly version = "v4" as const;
  private readonly env: FusedEnv;
  constructor(env: FusedEnv) {
    this.env = env;
  }
  info(): DexAdapterInfo {
    const a = this.availability();
    return {
      version: "v4",
      implemented: true,
      available: a.status === AVAILABILITY_STATUS.OK,
      reason:
        a.status === AVAILABILITY_STATUS.OK
          ? null
          : "V4 core (LaunchFactory / LaunchLocker / LaunchToken) is in this checkout. Fused AI factory/locker addresses are unset, so the adapter is not available.",
    };
  }
  availability(): Availability {
    return launchContractsAvailability(this.env);
  }
}

export function listDexAdapters(env: FusedEnv): readonly DexAdapter[] {
  return [new UnimplementedAdapter("v2"), new UnimplementedAdapter("v3"), new OpenLaunchV4Adapter(env)];
}

export function operationalDexVersions(env: FusedEnv): DexVersion[] {
  return listDexAdapters(env).filter((a) => a.info().available).map((a) => a.version);
}
