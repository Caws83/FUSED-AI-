import assert from "node:assert/strict";
import test from "node:test";
import { parseEventLogs } from "viem";
import { LAUNCH_FACTORY_ABI, FUSED_FACTORY_ABI } from "@fused-ai/blockchain";

const LAUNCHED_TOPIC = "0x" + "0".repeat(64);

test("Launched event is present on the factory ABI for indexer parsing", () => {
  const event = LAUNCH_FACTORY_ABI.find((item) => item.type === "event" && item.name === "Launched");
  assert.ok(event);
  assert.equal(event?.type, "event");
  assert.doesNotThrow(() => {
    parseEventLogs({ abi: LAUNCH_FACTORY_ABI, logs: [], eventName: "Launched" });
  });
  assert.equal(LAUNCHED_TOPIC.length, 66);
});

test("Fused Created and Trade events are present for curve indexing", () => {
  assert.ok(FUSED_FACTORY_ABI.some((item) => item.type === "event" && item.name === "Created"));
  assert.ok(FUSED_FACTORY_ABI.some((item) => item.type === "event" && item.name === "Trade"));
  assert.ok(FUSED_FACTORY_ABI.some((item) => item.type === "event" && item.name === "Graduated"));
  assert.doesNotThrow(() => {
    parseEventLogs({ abi: FUSED_FACTORY_ABI, logs: [], eventName: "Created" });
  });
});
