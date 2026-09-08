import assert from "node:assert/strict";
import test from "node:test";
import { loadEnv } from "@fused-ai/config";
import { listDexAdapters, operationalDexVersions } from "../src/index.ts";

test("no DEX version is advertised as operational without Fused AI contracts", () => {
  const env = loadEnv({});
  const adapters = listDexAdapters(env);
  assert.deepEqual(
    adapters.map((a) => [a.version, a.info().available, a.info().implemented]),
    [
      ["v2", false, false],
      ["v3", false, false],
      ["v4", false, true],
    ],
  );
  assert.deepEqual(operationalDexVersions(env), []);
});

test("v2 and v3 report not implemented", () => {
  const [v2] = listDexAdapters(loadEnv({}));
  assert.equal(v2?.info().implemented, false);
  assert.equal(v2?.availability().status, "ADAPTER_NOT_IMPLEMENTED");
});

test("v4 is implemented but unavailable until Fused AI addresses exist", () => {
  const adapters = listDexAdapters(loadEnv({}));
  const v4 = adapters.find((a) => a.version === "v4");
  assert.equal(v4?.info().implemented, true);
  assert.equal(v4?.info().available, false);
  assert.equal(v4?.availability().status, "CONTRACTS_NOT_DEPLOYED");
});

test("v4 becomes available only when factory and locker addresses are set", () => {
  const env = loadEnv({
    LAUNCH_FACTORY_ADDRESS: "0x0000000000000000000000000000000000000001",
    LAUNCH_LOCKER_ADDRESS: "0x0000000000000000000000000000000000000002",
  });
  const v4 = listDexAdapters(env).find((a) => a.version === "v4");
  assert.equal(v4?.info().implemented, true);
  assert.equal(v4?.info().available, true);
  assert.equal(v4?.availability().status, "OK");
});
