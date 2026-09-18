import assert from "node:assert/strict";
import test from "node:test";
import {
  FUSED_FEED_TEXT_MAX,
  FUSED_SOCIAL_PLATFORM,
  fusedFeedSocialPost,
  parseFusedFeedCreate,
  parseSocialPost,
} from "../src/index.ts";

const ADDRESS = "0xf5fD7A1e4C2B3A9D8E7C6B5A493827160192EE00";

test("fused is an accepted social platform", () => {
  const post = parseSocialPost({
    platform: FUSED_SOCIAL_PLATFORM,
    postId: "post-1",
    authorId: ADDRESS,
    authorUsername: ADDRESS,
    text: "Just launched ROAD on Robinhood Chain",
    url: "https://www.fusedai.org/trending",
    publishedAt: "2026-09-18T12:00:00.000Z",
    fetchedAt: "2026-09-18T12:00:00.000Z",
  });
  assert.ok(post);
  assert.equal(post?.platform, "fused");
  assert.equal(post?.authorUsername, ADDRESS);
  assert.equal(post?.authorUsername.length, 42);
});

test("empty fused posts are rejected", () => {
  assert.equal(parseFusedFeedCreate({ address: ADDRESS, text: "" }).ok, false);
  assert.equal(parseFusedFeedCreate({ address: ADDRESS, text: "   " }).ok, false);
  assert.equal(parseFusedFeedCreate({ address: ADDRESS, text: "short" }).ok, false);
});

test("fused feed create accepts a wallet post and builds a fused social post", () => {
  const parsed = parseFusedFeedCreate({
    address: ADDRESS,
    text: "Just launched ROAD on Robinhood Chain 🔥",
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) throw new Error("expected ok");
  const post = fusedFeedSocialPost({
    postId: "feed-1",
    address: parsed.address,
    text: parsed.text,
    now: new Date("2026-09-18T12:00:00.000Z"),
  });
  assert.ok(post);
  assert.equal(post?.platform, "fused");
  assert.equal(post?.authorId, ADDRESS);
  assert.equal(post?.authorUsername, ADDRESS);
  assert.ok(post!.text.length <= FUSED_FEED_TEXT_MAX);
});
