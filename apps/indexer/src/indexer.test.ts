import assert from "node:assert/strict";
import test from "node:test";
import { startIndexer, jsonSafe } from "./main.ts";

test("indexer logs can serialize BigInt block numbers", () => {
  assert.equal(jsonSafe({ fromBlock: 1n, toBlock: 4n }), '{"fromBlock":"1","toBlock":"4"}');
});

test("indexer does not start without database, rpc, and contracts", async () => {
  const result = await startIndexer();
  assert.equal(result.started, false);
  if (result.started === false) {
    assert.ok(result.reason && typeof result.reason === "object" && "status" in result.reason);
  }
});
