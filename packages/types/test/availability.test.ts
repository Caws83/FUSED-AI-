import assert from "node:assert/strict";
import test from "node:test";
import {
  AVAILABILITY_STATUS,
  adapterNotImplemented,
  isAvailable,
  notConfigured,
} from "../src/index.ts";

test("notConfigured is unavailable and lists missing keys", () => {
  const state = notConfigured(["AI_API_KEY", "AI_PROVIDER"]);
  assert.equal(state.status, AVAILABILITY_STATUS.NOT_CONFIGURED);
  assert.equal(isAvailable(state), false);
  assert.deepEqual(state.missing, ["AI_API_KEY", "AI_PROVIDER"]);
});

test("adapterNotImplemented never reports OK", () => {
  const state = adapterNotImplemented("UniswapV2");
  assert.equal(state.status, AVAILABILITY_STATUS.ADAPTER_NOT_IMPLEMENTED);
  assert.match(state.reason, /must not advertise/);
});
