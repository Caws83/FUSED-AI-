import assert from "node:assert/strict";
import test from "node:test";
import { indexerFreshnessFromParts } from "../src/indexer-lag.ts";

test("missing database is indexing, not an empty board", () => {
  const row = indexerFreshnessFromParts({
    databaseConfigured: false,
    launchCount: 0,
    latestIndexedBlock: null,
    latestRpcBlock: 100n,
    lagAlertBlocks: 200,
    confirmations: 2,
  });
  assert.equal(row.indexing, true);
  assert.equal(row.databaseConfigured, false);
});

test("caught-up indexer with zero launches is not indexing", () => {
  const row = indexerFreshnessFromParts({
    databaseConfigured: true,
    launchCount: 0,
    latestIndexedBlock: 117433400n,
    latestRpcBlock: 117433402n,
    lagAlertBlocks: 200,
    confirmations: 2,
  });
  assert.equal(row.indexing, false);
  assert.equal(row.lag, 2);
});

test("never-started indexer is indexing", () => {
  const row = indexerFreshnessFromParts({
    databaseConfigured: true,
    launchCount: 0,
    latestIndexedBlock: null,
    latestRpcBlock: 117440000n,
    lagAlertBlocks: 200,
    confirmations: 2,
  });
  assert.equal(row.indexing, true);
});

test("lag above alert threshold is indexing even with launches", () => {
  const row = indexerFreshnessFromParts({
    databaseConfigured: true,
    launchCount: 3,
    latestIndexedBlock: 100n,
    latestRpcBlock: 500n,
    lagAlertBlocks: 200,
    confirmations: 2,
  });
  assert.equal(row.indexing, true);
  assert.equal(row.lag, 400);
});
