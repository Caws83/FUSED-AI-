import type { Availability, Unavailable } from "@fused-ai/types";
import { isAvailable } from "@fused-ai/types";

export type Ok<T> = { ok: true; value: T };
export type Err<E = Unavailable> = { ok: false; error: E };
export type Result<T, E = Unavailable> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E = Unavailable>(error: E): Err<E> {
  return { ok: false, error };
}

export function fromAvailability<T>(availability: Availability, value: T): Result<T> {
  return isAvailable(availability) ? ok(value) : err(availability);
}

export function fail(availability: Availability): Err<Unavailable> {
  if (isAvailable(availability)) {
    throw new Error("fail() called with OK availability");
  }
  return err(availability);
}

export class FusedError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "FusedError";
    this.code = code;
  }
}
