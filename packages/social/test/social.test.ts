import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadEnv } from "@fused-ai/config";
import type { SocialPost } from "@fused-ai/types";
import { createSocialProvider, loadTrackedAccounts, scorePosts } from "../src/index.ts";

test("unconfigured social provider does not invent a feed", async () => {
  const provider = createSocialProvider(loadEnv({}));
  const trending = await provider.trending();
  assert.equal(trending.ok, false);
  if (!trending.ok) assert.equal(trending.error.status, "NOT_CONFIGURED");
});

test("empty tracked account file loads as empty registry", async () => {
  const dir = await mkdtemp(join(tmpdir(), "fused-social-"));
  const path = join(dir, "accounts.json");
  await writeFile(path, "[]");
  const result = await loadTrackedAccounts(path);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.length, 0);
});

test("scorePosts ranks from real input only", () => {
  const now = Date.parse("2026-09-08T12:00:00.000Z");
  const posts: SocialPost[] = [
    {
      platform: "x",
      postId: "1",
      authorId: "a",
      authorUsername: "a",
      text: "hello",
      url: "https://x.com/a/status/1",
      media: [],
      metrics: { likes: 10, replies: 1, reposts: 1, quotes: 0 },
      publishedAt: "2026-09-08T11:00:00.000Z",
      fetchedAt: "2026-09-08T12:00:00.000Z",
    },
    {
      platform: "x",
      postId: "2",
      authorId: "b",
      authorUsername: "b",
      text: "hot",
      url: "https://x.com/b/status/2",
      media: [],
      metrics: { likes: 1000, replies: 50, reposts: 80, quotes: 20 },
      publishedAt: "2026-09-08T11:50:00.000Z",
      fetchedAt: "2026-09-08T12:00:00.000Z",
    },
  ];
  const ranked = scorePosts(posts, now, { velocity: 0.45, recency: 0.25, totals: 0.3, priority: 0.1 });
  assert.equal(ranked[0]?.postId, "2");
});
