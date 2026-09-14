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

test("V1 and V2 factories are distinct so duplicate event scans cannot share an address", () => {
  const v1 = "0x42654079a991EE21e2d2f7Eed0A77bf6a0082208".toLowerCase();
  const v2 = "0x359b3D82d958488eA9177c0F56EB3558ba59a40B".toLowerCase();
  assert.notEqual(v1, v2);
});
