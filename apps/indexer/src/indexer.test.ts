import assert from "node:assert/strict";
import test from "node:test";
import { startIndexer } from "./main.ts";

test("indexer does not start without database, rpc, and contracts", async () => {
  const result = await startIndexer();
  assert.equal(result.started, false);
  assert.ok("status" in result.reason);
});
