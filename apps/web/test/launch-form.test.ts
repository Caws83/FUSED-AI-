import assert from "node:assert/strict";
import test from "node:test";
import { validateLaunchForm } from "@fused-ai/blockchain";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

test("launch form validation rejects empty name and accepts a real ticker", () => {
  assert.ok(validateLaunchForm({ name: "", symbol: "X", metadataURI: "" }));
  assert.equal(validateLaunchForm({ name: "Fused", symbol: "FUSE", metadataURI: "" }), null);
});

test("token detail and explore pages do not invent market data fields", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const explore = readFileSync(join(root, "src/app/explore/page.tsx"), "utf8");
  const token = readFileSync(join(root, "src/app/token/[address]/page.tsx"), "utf8");
  for (const phrase of ["market cap", "volume", "holders", "fake"]) {
    assert.equal(explore.toLowerCase().includes(phrase), false, phrase);
    assert.equal(token.toLowerCase().includes(phrase), false, phrase);
  }
});
