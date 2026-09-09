import assert from "node:assert/strict";
import test from "node:test";
import { clampSlippageBps, fdvWei, marketCapWei, minOut, progressBps, tradePriceX18, venueName } from "../src/index.ts";

test("curve helpers use real arithmetic", () => {
  assert.equal(marketCapWei(10n ** 16n, 10n ** 18n), 10n ** 16n);
  assert.equal(fdvWei(10n ** 16n, 10n ** 27n), 10n ** 25n);
  assert.equal(minOut(10_000n, 100), 9900n);
  assert.equal(progressBps(1n, 2n), 5000);
  assert.equal(progressBps(0n, 1n, true), 10_000);
  assert.equal(tradePriceX18(2n, 4n), 5n * 10n ** 17n);
  assert.equal(venueName(1), "uniswap_v4");
  assert.equal(clampSlippageBps(99999), 5000);
  assert.equal(clampSlippageBps(0), 1);
});
