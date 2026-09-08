import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTweet } from "../src/x-api.ts";
import { parseTrackedAccounts } from "@fused-ai/validation";

test("normalizeTweet maps real API fields and leaves missing metrics undefined", () => {
  const post = normalizeTweet(
    {
      id: "99",
      text: "hello",
      author_id: "7",
      created_at: "2026-09-08T12:00:00.000Z",
      public_metrics: { like_count: 3, reply_count: 1 },
    },
    [{ id: "7", username: "alice", name: "Alice", verified: true, profile_image_url: "https://pbs.twimg.com/a.jpg" }],
    [],
    "2026-09-08T12:01:00.000Z",
  );
  assert.ok(post);
  assert.equal(post?.authorUsername, "alice");
  assert.equal(post?.authorDisplayName, "Alice");
  assert.equal(post?.verified, true);
  assert.equal(post?.metrics.likes, 3);
  assert.equal(post?.metrics.reposts, undefined);
  assert.equal(post?.url, "https://x.com/alice/status/99");
});

test("tracked account file accepts username-only rows without fake platform IDs", () => {
  const accounts = parseTrackedAccounts([
    { platform: "x", username: "alice", category: "crypto", enabled: true, priority: 5 },
  ]);
  assert.equal(accounts.length, 1);
  assert.equal(accounts[0]?.platformUserId, "");
  assert.equal(accounts[0]?.username, "alice");
});
