import assert from "node:assert/strict";
import test from "node:test";
import { err, ok, sanitizeHttpUrl, stripControlChars } from "../src/index.ts";

test("result helpers", () => {
  assert.equal(ok(1).ok, true);
  assert.equal(err({ status: "NOT_CONFIGURED", reason: "x" }).ok, false);
});

test("sanitizeHttpUrl rejects non-http schemes", () => {
  assert.equal(sanitizeHttpUrl("javascript:alert(1)"), null);
  assert.equal(sanitizeHttpUrl("https://x.com/a/status/1")?.startsWith("https://"), true);
});

test("stripControlChars removes null bytes", () => {
  assert.equal(stripControlChars("hi\u0000there"), "hithere");
});
