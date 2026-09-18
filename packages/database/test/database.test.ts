import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadEnv, loadRepoEnv } from "@fused-ai/config";
import { createDatabaseClient } from "../src/index.ts";

const schema = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "schema.sql"), "utf8");

test("missing DATABASE_URL is DATABASE / NOT_CONFIGURED, not a fake connection", async () => {
  const db = createDatabaseClient(loadEnv({}));
  assert.equal(db.availability().status, "NOT_CONFIGURED");
  const ping = await db.ping();
  assert.equal(ping.ok, false);
});

test("schema declares social posts, optional profiles, and application token metadata", () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS fused_social_posts/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS fused_profiles/);
  assert.match(schema, /wallet_address     text PRIMARY KEY/);
  assert.match(schema, /display_name       text NOT NULL/);
  assert.match(schema, /pfp_url            text/);
  assert.match(schema, /nonce              bigint NOT NULL DEFAULT 0/);
  assert.equal(/INSERT\s+INTO\s+fused_profiles/i.test(schema), false);
  assert.doesNotMatch(schema, /\bIan\b|\bbugs\b/i);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS fused_token_metadata/);
  assert.match(schema, /image_url/);
  assert.match(schema, /source_post_url/);
});

test("schema declares trades, candles, holders, and transfer log dedup", () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS fused_trades/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS fused_candles/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS fused_holders/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS fused_transfer_logs/);
  assert.match(schema, /lifecycle_state/);
});

test("token metadata persists and joins onto launches when DATABASE_URL is set", async (t) => {
  loadRepoEnv();
  const env = loadEnv();
  if (!env.databaseUrl || !env.chainId) {
    t.skip("DATABASE_URL not configured");
    return;
  }
  const db = createDatabaseClient(env);
  const migrated = await db.migrate();
  if (!migrated.ok) {
    t.skip("reason" in migrated.error ? migrated.error.reason : "database unavailable");
    return;
  }
  const token = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const launch = await db.upsertLaunch({
    chainId: env.chainId,
    token,
    name: "Meta Persist",
    symbol: "META",
    launcher: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    quote: "0x0000000000000000000000000000000000000000",
    poolId: null,
    tokenId: "1",
    startTick: 0,
    lpFee: 0,
    supply: "0",
    metadataURI: "local://test",
    txHash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    blockNumber: 1n,
    createdAt: new Date(),
    factory: null,
    locker: null,
    dexVersion: "v4",
  });
  assert.equal(launch.ok, true);
  const meta = await db.upsertTokenMetadata({
    chainId: env.chainId,
    token,
    description: "application metadata only",
    imageId: "abc",
    imageUrl: "/api/media/fixture.png",
    sourcePlatform: "x",
    sourcePostId: "1",
    sourceAuthor: "example",
    sourcePostUrl: "https://x.com/example/status/1",
    sourceExcerpt: "hello",
  });
  assert.equal(meta.ok, true);
  const loaded = await db.getLaunch(env.chainId, token);
  assert.equal(loaded.ok, true);
  if (!loaded.ok || !loaded.value) throw new Error("expected launch");
  assert.equal(loaded.value.imageId, "abc");
  assert.equal(loaded.value.imageUrl, "/api/media/fixture.png");
  assert.equal(loaded.value.sourcePostUrl, "https://x.com/example/status/1");
  assert.equal(loaded.value.sourceAuthor, "example");
  await db.close();
});

test("listLaunches filters by chain_id", () => {
  const src = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "client.ts"), "utf8");
  assert.match(src, /WHERE l.chain_id = \$\{chainId\}/);
  assert.match(src, /m\.image_id, m\.image_url/);
  assert.match(src, /imageId: row\.image_id/);
});

test("schema isolates launches, trades, and cursors by chain_id", () => {
  assert.match(schema, /PRIMARY KEY \(chain_id, token\)/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS fused_sync_cursor/);
  assert.match(schema, /chain_id           integer PRIMARY KEY/);
  assert.match(schema, /PRIMARY KEY \(chain_id, factory\)/);
  assert.match(schema, /PRIMARY KEY \(chain_id, tx_hash, log_index\)/);
});

test("client uses postgres connection options helper and per-factory cursors", () => {
  const src = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "client.ts"), "utf8");
  assert.match(src, /postgresClientOptions/);
  assert.match(src, /fused_sync_cursor/);
  assert.match(src, /fused_factory_sync_cursor/);
  assert.match(src, /listLaunchesByLauncher/);
  assert.match(src, /listLaunchesForChains/);
  assert.match(src, /findLaunchesByToken/);
  assert.match(src, /listRecentSocialPosts/);
  assert.match(src, /LEFT JOIN fused_profiles/);
  assert.match(src, /getFusedProfile/);
  assert.match(src, /upsertFusedProfile/);
  assert.match(src, /profile_pfp_url/);
  assert.match(src, /profile_display_name/);
  assert.match(src, /ORDER BY p.published_at DESC/);
});

test("public Postgres URLs require TLS; local and Railway private DNS do not", async () => {
  const { postgresSslMode, postgresClientOptions } = await import("../src/postgres-options.ts");
  assert.equal(postgresSslMode("postgres://fused:fused@127.0.0.1:5432/fused_ai"), false);
  assert.equal(postgresSslMode("postgres://postgres:x@postgres.railway.internal:5432/railway"), false);
  assert.equal(postgresSslMode("postgres://postgres:x@altaria.proxy.rlwy.net:49142/railway"), "require");
  assert.equal(postgresSslMode("postgres://postgres:x@altaria.proxy.rlwy.net:49142/railway?sslmode=disable"), false);
  const remote = postgresClientOptions("postgres://postgres:x@altaria.proxy.rlwy.net:49142/railway");
  assert.equal(remote.ssl, "require");
});

test("feed lists overlay profile name and pfp without rewriting posts", async (t) => {
  loadRepoEnv();
  const env = loadEnv();
  if (!env.databaseUrl) {
    t.skip("DATABASE_URL not configured");
    return;
  }
  const db = createDatabaseClient(env);
  const migrated = await db.migrate();
  if (!migrated.ok) {
    t.skip("reason" in migrated.error ? migrated.error.reason : "database unavailable");
    return;
  }
  const wallet = `0x${randomBytes(20).toString("hex")}`;
  const postId = `profile-overlay-${Date.now()}`;
  const savedPost = await db.upsertSocialPost({
    platform: "fused",
    postId,
    authorId: wallet,
    authorUsername: wallet,
    authorDisplayName: wallet,
    text: "old post before a profile existed",
    url: "https://www.fusedai.org/trending",
    media: [],
    metrics: {},
    publishedAt: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
  });
  assert.equal(savedPost.ok, true);

  const before = await db.listRecentSocialPosts({ platform: "fused", limit: 50 });
  assert.equal(before.ok, true);
  if (!before.ok) throw new Error("expected posts");
  const raw = before.value.find((row) => row.postId === postId);
  assert.ok(raw);
  assert.equal(raw?.authorDisplayName, wallet);
  assert.equal(raw?.profileDisplayName, undefined);
  assert.equal(raw?.avatarUrl, undefined);

  const first = await db.upsertFusedProfile({
    walletAddress: wallet,
    displayName: "Ada",
    pfpUrl: "https://cdn.example/ada.png",
    expectedNonce: 0,
  });
  assert.equal(first.ok, true);
  if (!first.ok) throw new Error("expected profile");
  assert.equal(first.value.applied, true);
  assert.equal(first.value.profile?.nonce, 1);

  const replay = await db.upsertFusedProfile({
    walletAddress: wallet,
    displayName: "Replay",
    pfpUrl: "https://cdn.example/replay.png",
    expectedNonce: 0,
  });
  assert.equal(replay.ok, true);
  if (!replay.ok) throw new Error("expected replay");
  assert.equal(replay.value.applied, false);

  const after = await db.listRecentSocialPosts({ platform: "fused", limit: 50 });
  assert.equal(after.ok, true);
  if (!after.ok) throw new Error("expected posts after profile");
  const overlaid = after.value.find((row) => row.postId === postId);
  assert.equal(overlaid?.authorDisplayName, wallet);
  assert.equal(overlaid?.profileDisplayName, "Ada");
  assert.equal(overlaid?.avatarUrl, "https://cdn.example/ada.png");
  assert.equal(overlaid?.text, "old post before a profile existed");

  const newPostId = `profile-overlay-new-${Date.now()}`;
  const newPost = await db.upsertSocialPost({
    platform: "fused",
    postId: newPostId,
    authorId: wallet,
    authorUsername: wallet,
    authorDisplayName: wallet,
    text: "new post after a profile existed",
    url: "https://www.fusedai.org/trending",
    media: [],
    metrics: {},
    publishedAt: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
  });
  assert.equal(newPost.ok, true);
  const listed = await db.listRecentSocialPosts({ platform: "fused", limit: 50 });
  assert.equal(listed.ok, true);
  if (!listed.ok) throw new Error("expected posts after new post");
  const fresh = listed.value.find((row) => row.postId === newPostId);
  assert.equal(fresh?.authorDisplayName, wallet);
  assert.equal(fresh?.profileDisplayName, "Ada");
  assert.equal(fresh?.avatarUrl, "https://cdn.example/ada.png");
  await db.close();
});

