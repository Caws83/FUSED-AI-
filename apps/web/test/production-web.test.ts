import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("health route is static JSON and does not import X, AI, or database", () => {
  const src = readFileSync(join(root, "src/app/api/health/route.ts"), "utf8");
  assert.match(src, /FUSED AI Web/);
  assert.match(src, /status:\s*"ok"/);
  assert.equal(src.includes("X_BEARER_TOKEN"), false);
  assert.equal(src.includes("AI_API_KEY"), false);
  assert.equal(src.includes("DATABASE_URL"), false);
  assert.equal(src.includes("loadEnv"), false);
});

test("token terminal distinguishes native graduation target from USD display estimate", () => {
  const src = readFileSync(join(root, "src/components/TokenTerminal.tsx"), "utf8");
  assert.match(src, /Graduation target/);
  assert.match(src, /Display USD estimate/);
  assert.match(src, /not a live price/);
});

test("next config traces the monorepo root", () => {
  const src = readFileSync(join(root, "next.config.ts"), "utf8");
  assert.match(src, /outputFileTracingRoot/);
});
