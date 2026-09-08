import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_LP_FEE,
  DEFAULT_START_TICK,
  LAUNCH_FACTORY_ABI,
  NATIVE_QUOTE,
  listDexAdapters,
  toLaunchParams,
  validateLaunchForm,
} from "../src/index.ts";
import { loadEnv } from "@fused-ai/config";

test("launch form validation matches factory fields", () => {
  assert.equal(validateLaunchForm({ name: "", symbol: "ABC", metadataURI: "" }), "Name must be 1–32 characters.");
  assert.equal(validateLaunchForm({ name: "Ok", symbol: "BAD TICKER", metadataURI: "" }), "Ticker must be 1–11 letters or numbers.");
  assert.equal(validateLaunchForm({ name: "Local Fuse", symbol: "LFUSE", metadataURI: "local://x" }), null);
});

test("toLaunchParams maps only real LaunchParams fields", () => {
  const p = toLaunchParams({
    name: " Local Fuse ",
    symbol: "lfuse",
    metadataURI: "hello",
    creator: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    salt: "0x1111111111111111111111111111111111111111111111111111111111111111",
  });
  assert.equal(p.quote, NATIVE_QUOTE);
  assert.equal(p.supply, 0n);
  assert.equal(p.startTick, DEFAULT_START_TICK);
  assert.equal(p.lpFee, DEFAULT_LP_FEE);
  assert.equal(p.symbol, "LFUSE");
  assert.equal(p.recipients[0]?.bps, 10_000);
  assert.equal(LAUNCH_FACTORY_ABI.some((x) => x.type === "function" && x.name === "launch"), true);
});

test("v4 adapter available only with factory and locker addresses", () => {
  const missing = listDexAdapters(loadEnv({}));
  assert.equal(missing.find((a) => a.version === "v4")?.info().available, false);
  const ready = listDexAdapters(
    loadEnv({
      LAUNCH_FACTORY_ADDRESS: "0x0000000000000000000000000000000000000001",
      LAUNCH_LOCKER_ADDRESS: "0x0000000000000000000000000000000000000002",
    }),
  );
  assert.equal(ready.find((a) => a.version === "v4")?.info().available, true);
});

test("example deployment file has the required contract keys and no invented addresses", () => {
  const file = join(dirname(fileURLToPath(import.meta.url)), "../../../deployments/local-31337.example.json");
  const json = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(json.chainId, 31337);
  assert.equal(json.rpcUrl, "http://127.0.0.1:8545");
  assert.deepEqual(Object.keys(json.contracts).sort(), [
    "launchFactory",
    "launchLocker",
    "permit2",
    "poolManager",
    "positionManager",
    "universalRouter",
  ]);
  assert.equal(json.contracts.launchFactory, "");
  assert.equal(json.contracts.universalRouter, null);
});
