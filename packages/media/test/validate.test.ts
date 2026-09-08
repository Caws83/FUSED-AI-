import assert from "node:assert/strict";
import test from "node:test";
import { validateImage } from "../src/validate.ts";

const PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

test("accepts a real PNG and rejects SVG or oversized payloads", () => {
  const ok = validateImage(PNG, "image/png");
  assert.equal(ok.ok, true);
  const svg = validateImage(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>"), "image/svg+xml");
  assert.equal(svg.ok, false);
  const huge = new Uint8Array(2 * 1024 * 1024 + 1);
  huge.set(PNG.subarray(0, 8), 0);
  const over = validateImage(huge, "image/png");
  assert.equal(over.ok, false);
});

test("rejects MIME that does not match magic bytes", () => {
  const mismatch = validateImage(PNG, "image/jpeg");
  assert.equal(mismatch.ok, false);
});
