import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

test("explore and token pages use real imageUrl or the Fused fallback mark", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const boards = readFileSync(join(root, "src/lib/boards.tsx"), "utf8");
  const terminal = readFileSync(join(root, "src/components/TokenTerminal.tsx"), "utf8");
  assert.ok(boards.includes("tokenImageSrc"));
  assert.ok(terminal.includes("tokenImageSrc"));
  assert.ok(terminal.includes("Origin post"));
  assert.ok(terminal.includes("sourcePostUrl"));
});
