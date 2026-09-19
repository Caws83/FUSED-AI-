import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { FUSE_HANDOFF_KEY, writeFuseHandoff } from "../src/lib/fuse-handoff.ts";
import { relativeTime, shortenAddress } from "../src/lib/feed.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function src(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

test("wallet addresses shorten for feed display", () => {
  assert.equal(shortenAddress("0xf5fD7A1e4C2B3A9D8E7C6B5A493827160192EE00"), "0xf5fD...EE00");
});

test("relative timestamps stay compact", () => {
  const now = Date.parse("2026-09-18T12:02:00.000Z");
  assert.equal(relativeTime("2026-09-18T12:00:00.000Z", now), "2m");
});

test("fused feed lists recent posts without X credentials", () => {
  const loader = src("src/lib/social.ts");
  assert.match(loader, /listRecentSocialPosts/);
  assert.match(loader, /loadFusedFeedPosts/);
  const fusedFn = loader.slice(loader.indexOf("export async function loadFusedFeedPosts"));
  assert.equal(fusedFn.includes("socialAvailability"), false);
  assert.equal(fusedFn.includes("createSocialProvider"), false);
  assert.equal(fusedFn.includes("X_BEARER_TOKEN"), false);
  assert.match(src("src/lib/social.ts"), /export async function loadTrendingPosts/);
});

test("POST /api/social/posts validates wallet and empty text", () => {
  const route = src("src/app/api/social/posts/route.ts");
  assert.match(route, /parseFusedFeedCreate/);
  assert.match(route, /fusedFeedSocialPost/);
  assert.match(route, /upsertSocialPost/);
  assert.equal(route.includes("siwe"), false);
  assert.equal(route.includes("signMessage"), false);
});

test("FUSED FEED renders on /community and is readable without a wallet", () => {
  const page = src("src/app/community/page.tsx");
  const composer = src("src/components/FeedComposer.tsx");
  assert.match(page, /Community/);
  assert.match(page, /Find the conversation\. Fuse the moment\./);
  assert.match(page, /loadFusedFeedPosts/);
  assert.match(page, /<FeedComposer/);
  assert.match(page, /<FeedPosts/);
  assert.equal(page.includes("loadTrendingPosts"), false);
  assert.match(composer, /What's happening\?/);
  assert.match(composer, /Connect your wallet to post\./);
  assert.match(composer, /\/api\/social\/posts/);
  assert.match(composer, /useAccount/);
});

test("FUSE THIS writes the complete post text into the existing fuse handoff and navigates to /launch", () => {
  const feed = src("src/components/FeedPosts.tsx");
  assert.match(feed, /writeFuseHandoff\(text\)/);
  assert.match(feed, /fuseThis\(post\.text\)/);
  assert.match(feed, /router\.push\("\/launch"\)/);
  assert.match(feed, /FUSE THIS/);
  assert.equal(feed.includes("/api/ai/fuse"), false);
  assert.equal(feed.includes("/api/social/fuse"), false);

  const store = new MemoryStorage();
  const complete = "Just launched ROAD on Robinhood Chain 🔥 keep the whole post";
  assert.equal(writeFuseHandoff(complete, store), true);
  assert.equal(store.getItem(FUSE_HANDOFF_KEY), JSON.stringify({ v: 1, text: complete }));
});

test("existing launch paste flow is unchanged", () => {
  const page = src("src/app/launch/page.tsx");
  const fuse = src("src/components/FusePost.tsx");
  const quick = src("src/components/QuickFuse.tsx");
  assert.match(fuse, /takeFuseHandoff/);
  assert.match(fuse, /\/api\/ai\/fuse/);
  assert.match(quick, /writeFuseHandoff/);
  assert.equal(page.includes("FeedPosts"), false);
  assert.equal(page.includes("/api/social/posts"), false);
});

test("homepage feed slice uses native FUSED posts", () => {
  const home = src("src/app/page.tsx");
  assert.match(home, /loadFusedFeedPosts/);
  assert.match(home, /<FeedPosts/);
  assert.match(home, /posts\.slice\(0, 4\)/);
  assert.match(home, /layout="grid"/);
  assert.equal(home.includes("loadTrendingPosts"), false);
  assert.match(home, /<QuickFuse/);
  assert.match(home, /HowItWorks/);
  assert.match(home, /how-it-works\.mp4/);
});

test("nav labels the feed Community and /trending redirects there", () => {
  const nav = src("src/lib/nav.ts");
  assert.match(nav, /href: "\/community"/);
  assert.match(nav, /label: "Community"/);
  assert.equal(nav.includes("/trending"), false);
  assert.equal(nav.includes("Trending"), false);
  const redirect = src("src/app/trending/page.tsx");
  assert.match(redirect, /permanentRedirect\("\/community"\)/);
});
