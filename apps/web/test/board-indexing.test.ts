import assert from "node:assert/strict";
import test from "node:test";
import { boardEmptyCopy } from "../src/lib/launches.ts";
import { indexerFreshnessFromParts } from "@fused-ai/config";

test("empty boards say Indexing when the indexer is behind or missing", () => {
  const copy = boardEmptyCopy(true, "live");
  assert.equal(copy.title, "Indexing…");
  assert.match(copy.body, /do not disappear/i);
});

test("caught-up empty boards keep the real empty copy", () => {
  const copy = boardEmptyCopy(false, "live");
  assert.equal(copy.title, "No live curves yet.");
});

test("production chain filter is chainId plus token address, not Anvil", () => {
  const row = indexerFreshnessFromParts({
    databaseConfigured: true,
    launchCount: 2,
    latestIndexedBlock: 117433209n,
    latestRpcBlock: 117433300n,
    lagAlertBlocks: 200,
    confirmations: 2,
  });
  assert.equal(row.indexing, false);
  assert.equal(row.lag, 91);
});
