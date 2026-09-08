import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseXPostUrl } from "@fused-ai/social";

test("Fuse URL parser is used by the fuse API route", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const route = readFileSync(join(root, "src/app/api/social/fuse/route.ts"), "utf8");
  assert.ok(route.includes("parseXPostUrl"));
  assert.ok(route.includes("getPost"));
  assert.equal(parseXPostUrl("https://x.com/a/status/1")?.postId, "1");
});

test("launch page loads a post id server-side instead of a payload query", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const page = readFileSync(join(root, "src/app/launch/page.tsx"), "utf8");
  assert.ok(page.includes("loadSourcePost"));
  assert.equal(page.includes("sourceText="), false);
});
