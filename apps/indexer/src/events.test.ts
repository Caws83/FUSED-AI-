import assert from "node:assert/strict";
import test from "node:test";
import { parseEventLogs } from "viem";
import { LAUNCH_FACTORY_ABI } from "@fused-ai/blockchain";

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
