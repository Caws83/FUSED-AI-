import assert from "node:assert/strict";
import test from "node:test";
import { aiLaunchStatus } from "./main.ts";

test("AI launch service does not emit fabricated drafts", () => {
  assert.notEqual(aiLaunchStatus().status, "OK");
});
