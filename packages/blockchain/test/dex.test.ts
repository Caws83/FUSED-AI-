import assert from "node:assert/strict";
import test from "node:test";
import { loadEnv } from "@fused-ai/config";
import { listDexAdapters, operationalDexVersions } from "../src/index.ts";

test("no DEX version is advertised as operational without Fused AI contracts", () => {
  const env = loadEnv({});
  const adapters = listDexAdapters(env);
  assert.deepEqual(
    adapters.map((a) => [a.version, a.info().available]),
    [
      ["v2", false],
      ["v3", false],
      ["v4", false],
    ],
  );
  assert.deepEqual(operationalDexVersions(env), []);
});

test("v2 and v3 report not implemented", () => {
  const [v2] = listDexAdapters(loadEnv({}));
  assert.equal(v2?.info().implemented, false);
  assert.equal(v2?.availability().status, "ADAPTER_NOT_IMPLEMENTED");
});
