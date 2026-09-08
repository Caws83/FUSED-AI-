/**
 * Explicit dependency states. Production code must return one of these
 * instead of substituting mock data when a dependency is missing.
 */
export const AVAILABILITY_STATUS = {
  OK: "OK",
  NOT_CONFIGURED: "NOT_CONFIGURED",
  PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  RPC_UNAVAILABLE: "RPC_UNAVAILABLE",
  DATABASE_UNAVAILABLE: "DATABASE_UNAVAILABLE",
  CONTRACTS_NOT_DEPLOYED: "CONTRACTS_NOT_DEPLOYED",
  ADAPTER_NOT_IMPLEMENTED: "ADAPTER_NOT_IMPLEMENTED",
} as const;

export type AvailabilityStatus = (typeof AVAILABILITY_STATUS)[keyof typeof AVAILABILITY_STATUS];

export type Available = {
  status: typeof AVAILABILITY_STATUS.OK;
};

export type Unavailable = {
  status: Exclude<AvailabilityStatus, typeof AVAILABILITY_STATUS.OK>;
  missing?: readonly string[];
  reason: string;
};

export type Availability = Available | Unavailable;

export function isAvailable(value: Availability): value is Available {
  return value.status === AVAILABILITY_STATUS.OK;
}

export function notConfigured(missing: readonly string[], reason?: string): Unavailable {
  return {
    status: AVAILABILITY_STATUS.NOT_CONFIGURED,
    missing,
    reason: reason ?? `Missing required configuration: ${missing.join(", ")}`,
  };
}

export function providerUnavailable(reason: string): Unavailable {
  return { status: AVAILABILITY_STATUS.PROVIDER_UNAVAILABLE, reason };
}

export function rpcUnavailable(reason: string): Unavailable {
  return { status: AVAILABILITY_STATUS.RPC_UNAVAILABLE, reason };
}

export function databaseUnavailable(reason: string): Unavailable {
  return { status: AVAILABILITY_STATUS.DATABASE_UNAVAILABLE, reason };
}

export function contractsNotDeployed(reason: string): Unavailable {
  return { status: AVAILABILITY_STATUS.CONTRACTS_NOT_DEPLOYED, reason };
}

export function adapterNotImplemented(adapter: string): Unavailable {
  return {
    status: AVAILABILITY_STATUS.ADAPTER_NOT_IMPLEMENTED,
    reason: `${adapter} is not implemented in this Fused AI checkout. The UI must not advertise it as operational.`,
  };
}
