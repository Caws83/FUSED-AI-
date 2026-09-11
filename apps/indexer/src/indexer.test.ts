import assert from "node:assert/strict";
import test from "node:test";
import { startIndexer, jsonSafe } from "./main.ts";
import { chunkBlockRange } from "./sync.ts";

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

test("backfill splits large ranges from the factory start block, not from now", () => {
  const chunks = chunkBlockRange(117433209n, 117437208n, 2000n);
  assert.equal(chunks[0]?.from, 117433209n);
  assert.equal(chunks.at(-1)?.to, 117437208n);
  assert.ok(chunks.length >= 2);
  for (const chunk of chunks) {
    assert.ok(chunk.to - chunk.from + 1n <= 2000n);
  }
});
