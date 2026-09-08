import assert from "node:assert/strict";
import test from "node:test";
import { parseXPostUrl } from "../src/x-url.ts";

test("parses https x.com and twitter.com status URLs", () => {
  const a = parseXPostUrl("https://x.com/foo_bar/status/1234567890123456789?s=20");
  assert.deepEqual(a, { username: "foo_bar", postId: "1234567890123456789" });
  const b = parseXPostUrl("https://twitter.com/foo/status/42");
  assert.deepEqual(b, { username: "foo", postId: "42" });
});

test("rejects non-https, other hosts, and malformed paths", () => {
  assert.equal(parseXPostUrl("http://x.com/foo/status/1"), null);
  assert.equal(parseXPostUrl("https://evil.com/foo/status/1"), null);
  assert.equal(parseXPostUrl("https://x.com/foo/statuses/1"), null);
  assert.equal(parseXPostUrl("javascript:alert(1)"), null);
});
