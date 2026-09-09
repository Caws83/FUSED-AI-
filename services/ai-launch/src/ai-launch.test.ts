import assert from "node:assert/strict";
import test from "node:test";
import { loadEnv } from "@fused-ai/config";
import { aiLaunchStatus } from "./main.ts";

test("AI launch service does not emit fabricated drafts without credentials", () => {
  assert.notEqual(aiLaunchStatus(loadEnv({})).status, "OK");
});
