import assert from "node:assert/strict";
import test from "node:test";
import { loadEnv } from "@fused-ai/config";
import { createDatabaseClient } from "../src/index.ts";

test("missing DATABASE_URL is DATABASE / NOT_CONFIGURED, not a fake connection", async () => {
  const db = createDatabaseClient(loadEnv({}));
  assert.equal(db.availability().status, "NOT_CONFIGURED");
  const ping = await db.ping();
  assert.equal(ping.ok, false);
});
