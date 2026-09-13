import assert from "node:assert/strict";
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

test("schema declares social posts and application token metadata", () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS fused_social_posts/);
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

test("client uses postgres connection options helper", () => {
  const src = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "client.ts"), "utf8");
  assert.match(src, /postgresClientOptions/);
  assert.match(src, /fused_sync_cursor/);
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

