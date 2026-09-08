import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

test("explore and token pages use real imageUrl or the Fused fallback mark", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const explore = readFileSync(join(root, "src/app/explore/page.tsx"), "utf8");
  const token = readFileSync(join(root, "src/app/token/[address]/page.tsx"), "utf8");
  assert.ok(explore.includes("fused-token.svg"));
  assert.ok(token.includes("fused-token.svg"));
  assert.ok(token.includes("Origin"));
  assert.ok(token.includes("sourcePostUrl"));
});
