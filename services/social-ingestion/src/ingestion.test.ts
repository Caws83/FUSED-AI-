import assert from "node:assert/strict";
import test from "node:test";
import { runSocialIngestion } from "./main.ts";

test("ingestion service exits unavailable instead of mocking posts", async () => {
  const result = await runSocialIngestion();
  assert.equal(result.ok, false);
});
