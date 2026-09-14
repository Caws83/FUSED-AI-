import { ROBINHOOD_MAINNET_CHAIN_ID } from "./networks.ts";

export type LaunchVersion = "v1" | "v2";

export type LaunchGeneration = {
  version: LaunchVersion;
  factory: string;
  locker: string | null;
  deployBlock: number | null;
};

export type LaunchRouting = {
  defaultVersion: LaunchVersion;
  v1: LaunchGeneration | null;
  v2: LaunchGeneration | null;
};

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export function isHexAddress(value: string | null | undefined): value is string {
  return Boolean(value && ADDRESS_RE.test(value));
}

export function sameAddress(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

function asGeneration(
  version: LaunchVersion,
  factory: string | null,
  locker: string | null,
  deployBlock: number | null,
): LaunchGeneration | null {
  if (!isHexAddress(factory)) return null;
  return {
    version,
    factory,
    locker: isHexAddress(locker) ? locker : null,
    deployBlock: deployBlock != null && Number.isInteger(deployBlock) ? deployBlock : null,
  };
}

export function parseLaunchVersion(raw: string | null | undefined): LaunchVersion | null {
  const v = raw?.trim().toLowerCase();
  if (v === "v1" || v === "v2") return v;
  return null;
}

export function parseLaunchRouting(input: {
  chainId: number | null;
  defaultFactory: string | null;
  defaultLocker: string | null;
  defaultVersionRaw: string | null;
  v1Factory: string | null;
  v1Locker: string | null;
  v1DeployBlock: number | null;
  v2Factory: string | null;
  v2Locker: string | null;
  v2DeployBlock: number | null;
}): LaunchRouting {
  // Mainnet 4663 stays v1-only. Never default new launches to a testnet V2 address.
  if (input.chainId === ROBINHOOD_MAINNET_CHAIN_ID) {
    const v1 =
      asGeneration("v1", input.v1Factory, input.v1Locker, input.v1DeployBlock) ??
      asGeneration("v1", input.defaultFactory, input.defaultLocker, input.v1DeployBlock);
    return { defaultVersion: "v1", v1, v2: null };
  }

  const explicitV1 = asGeneration("v1", input.v1Factory, input.v1Locker, input.v1DeployBlock);
  const explicitV2 = asGeneration("v2", input.v2Factory, input.v2Locker, input.v2DeployBlock);
  let v1 = explicitV1;
  let v2 = explicitV2;

  if (!v1 && !v2 && isHexAddress(input.defaultFactory)) {
    const requested = parseLaunchVersion(input.defaultVersionRaw) ?? "v1";
    const only = asGeneration(requested, input.defaultFactory, input.defaultLocker, requested === "v2" ? input.v2DeployBlock : input.v1DeployBlock);
    if (requested === "v2") v2 = only;
    else v1 = only;
  } else {
    if (!v2 && isHexAddress(input.defaultFactory) && !sameAddress(input.defaultFactory, v1?.factory)) {
      v2 = asGeneration("v2", input.defaultFactory, input.defaultLocker, input.v2DeployBlock);
    }
    if (!v1 && isHexAddress(input.defaultFactory) && !sameAddress(input.defaultFactory, v2?.factory)) {
      v1 = asGeneration("v1", input.defaultFactory, input.defaultLocker, input.v1DeployBlock);
    }
  }

  const requested = parseLaunchVersion(input.defaultVersionRaw);
  let defaultVersion: LaunchVersion;
  if (requested === "v2" && v2) defaultVersion = "v2";
  else if (requested === "v1" && v1) defaultVersion = "v1";
  else if (v2) defaultVersion = "v2";
  else defaultVersion = "v1";

  return { defaultVersion, v1, v2 };
}

export function defaultLaunchGeneration(routing: LaunchRouting): LaunchGeneration | null {
  return routing.defaultVersion === "v2" ? routing.v2 : routing.v1;
}

export function indexedLaunchFactories(routing: LaunchRouting): LaunchGeneration[] {
  const out: LaunchGeneration[] = [];
  const seen = new Set<string>();
  for (const gen of [routing.v1, routing.v2]) {
    if (!gen?.factory) continue;
    const key = gen.factory.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(gen);
  }
  return out;
}

export function launchVersionOf(factory: string | null | undefined, routing: LaunchRouting): LaunchVersion | null {
  if (!factory) return null;
  if (sameAddress(factory, routing.v2?.factory)) return "v2";
  if (sameAddress(factory, routing.v1?.factory)) return "v1";
  return null;
}

export function isKnownLaunchFactory(factory: string | null | undefined, routing: LaunchRouting): boolean {
  return launchVersionOf(factory, routing) != null;
}

export function generationForFactory(factory: string | null | undefined, routing: LaunchRouting): LaunchGeneration | null {
  const version = launchVersionOf(factory, routing);
  if (version === "v2") return routing.v2;
  if (version === "v1") return routing.v1;
  return null;
}

/** Trade/read routing: only the factory that actually owns the market. Never the current default. */
export function tradeFactoryForLaunch(
  factory: string | null | undefined,
  routing: LaunchRouting,
): string | null {
  const gen = generationForFactory(factory, routing);
  return gen?.factory ?? null;
}

export function lockerForFactory(factory: string | null | undefined, routing: LaunchRouting): string | null {
  return generationForFactory(factory, routing)?.locker ?? null;
}

export function earliestIndexerStartBlock(routing: LaunchRouting, fallback: number | null): number | null {
  const blocks = indexedLaunchFactories(routing)
    .map((row) => row.deployBlock)
    .filter((n): n is number => n != null);
  if (blocks.length === 0) return fallback;
  const min = Math.min(...blocks);
  if (fallback == null) return min;
  return Math.min(min, fallback);
}