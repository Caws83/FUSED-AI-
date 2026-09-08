import type { Availability, AvailabilityStatus } from "@fused-ai/types";
import type { DisplayStatus } from "@fused-ai/ui";

export function toDisplayStatus(status: AvailabilityStatus | string): DisplayStatus {
  switch (status) {
    case "OK":
      return "READY";
    case "NOT_CONFIGURED":
      return "NOT_CONFIGURED";
    case "CONTRACTS_NOT_DEPLOYED":
      return "NOT_DEPLOYED";
    case "ADAPTER_NOT_IMPLEMENTED":
      return "PLANNED";
    default:
      return "UNAVAILABLE";
  }
}

export function availabilityReason(value: Availability): string {
  return "reason" in value ? value.reason : "configured";
}
