import assert from "node:assert/strict";
import test from "node:test";
import { launchSourceFromPayload, launchSourceFromText } from "../src/lib/launch-source.ts";

test("pasted X URL becomes a persisted source post", () => {
  const source = launchSourceFromText("just launched this\nhttps://x.com/alice/status/99");
  assert.equal(source.sourcePlatform, "x");
  assert.equal(source.sourceAuthor, "alice");
  assert.equal(source.sourcePostId, "99");
  assert.equal(source.sourcePostUrl, "https://x.com/alice/status/99");
});

test("foreign URLs are not stored as the origin post", () => {
  const source = launchSourceFromPayload({
    sourcePostUrl: "https://evil.com/alice/status/99",
    sourceAuthor: "alice",
  });
  assert.equal(source.sourcePostUrl, null);
  assert.equal(source.sourceAuthor, null);
});
