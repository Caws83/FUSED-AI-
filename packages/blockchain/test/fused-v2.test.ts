import assert from "node:assert/strict";
import test from "node:test";
import { FUSED_FACTORY_ABI, FUSED_FACTORY_CLAIM_ABI, FUSED_FACTORY_V2_ABI } from "../src/index.ts";

test("V2 ABI adds claimable accounting without replacing create/buy/sell", () => {
  assert.ok(FUSED_FACTORY_ABI.some((item) => item.type === "function" && item.name === "create"));
  assert.ok(FUSED_FACTORY_ABI.some((item) => item.type === "function" && item.name === "buy"));
  assert.ok(FUSED_FACTORY_ABI.some((item) => item.type === "function" && item.name === "sell"));
  assert.ok(FUSED_FACTORY_CLAIM_ABI.some((item) => item.type === "function" && item.name === "claim"));
  assert.ok(FUSED_FACTORY_CLAIM_ABI.some((item) => item.type === "function" && item.name === "claimFor"));
  assert.ok(FUSED_FACTORY_CLAIM_ABI.some((item) => item.type === "function" && item.name === "claimable"));
  assert.ok(FUSED_FACTORY_V2_ABI.some((item) => item.type === "function" && item.name === "create"));
  assert.ok(FUSED_FACTORY_V2_ABI.some((item) => item.type === "function" && item.name === "claim"));
});
