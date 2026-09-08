import assert from "node:assert/strict";
import test from "node:test";
import { loadEnv } from "@fused-ai/config";
import { createSocialProvider } from "@fused-ai/social";

test("trending endpoint data source refuses mocks when unconfigured", async () => {
  const result = await createSocialProvider(loadEnv({})).trending();
  assert.equal(result.ok, false);
});
