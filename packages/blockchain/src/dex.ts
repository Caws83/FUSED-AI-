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
 * V4 is implemented in unmodified OpenLaunch at upstream/openlaunch/contracts.
 * Fused AI production config does not point at those addresses, so this adapter
 * reports CONTRACTS_NOT_DEPLOYED until a Fused AI deployment exists.
 */
class OpenLaunchV4ReferenceAdapter implements DexAdapter {
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
          : "V4 launch path exists as unmodified OpenLaunch reference code. Fused AI factory/locker addresses are unset.",
    };
  }
  availability(): Availability {
    return launchContractsAvailability(this.env);
  }
}

export function listDexAdapters(env: FusedEnv): readonly DexAdapter[] {
  return [new UnimplementedAdapter("v2"), new UnimplementedAdapter("v3"), new OpenLaunchV4ReferenceAdapter(env)];
}

export function operationalDexVersions(env: FusedEnv): DexVersion[] {
  return listDexAdapters(env).filter((a) => a.info().available).map((a) => a.version);
}
