import assert from "node:assert/strict";
import test from "node:test";
import { candleBucketStart } from "../src/index.ts";

test("candle buckets align to interval starts", () => {
  const at = new Date("2026-09-09T12:07:33.000Z");
  assert.equal(candleBucketStart(at, 60).toISOString(), "2026-09-09T12:07:00.000Z");
  assert.equal(candleBucketStart(at, 300).toISOString(), "2026-09-09T12:05:00.000Z");
  assert.equal(candleBucketStart(at, 900).toISOString(), "2026-09-09T12:00:00.000Z");
  assert.equal(candleBucketStart(at, 3600).toISOString(), "2026-09-09T12:00:00.000Z");
});
