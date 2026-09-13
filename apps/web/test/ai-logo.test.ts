import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("AI logo route stores through generateAndStoreTokenLogo and never uses NEXT_PUBLIC secrets", () => {
  const src = readFileSync(join(root, "src/app/api/ai/image/route.ts"), "utf8");
  assert.match(src, /generateAndStoreTokenLogo/);
  assert.match(src, /createMediaStore/);
  assert.match(src, /runtime = "nodejs"/);
  assert.match(src, /maxDuration = 60/);
  assert.equal(src.includes("NEXT_PUBLIC_"), false);
  assert.equal(src.includes("placeholder"), false);
  assert.equal(src.includes("stock"), false);
});

test("fuse image path stores through the media abstraction", () => {
  const fuse = readFileSync(join(root, "src/lib/fuse-post.ts"), "utf8");
  const route = readFileSync(join(root, "src/app/api/ai/fuse/route.ts"), "utf8");
  assert.match(fuse, /generateAndStoreTokenLogo/);
  assert.match(fuse, /createMediaStore/);
  assert.equal(fuse.includes("fetch(input.imageUrl"), false);
  assert.match(route, /runtime = "nodejs"/);
  assert.match(route, /maxDuration = 90/);
  assert.equal(route.includes("NEXT_PUBLIC_"), false);
});

test("launch form returns the generated public URL and keeps manual upload", () => {
  const manual = readFileSync(join(root, "src/components/ManualLaunch.tsx"), "utf8");
  const upload = readFileSync(join(root, "src/app/api/media/upload/route.ts"), "utf8");
  assert.match(manual, /setImagePreview\(json\.url\)/);
  assert.match(manual, /\/api\/ai\/image/);
  assert.match(manual, /\/api\/media\/upload/);
  assert.match(manual, /generatingLogo/);
  assert.match(upload, /validateImage/);
  assert.match(upload, /createMediaStore/);
  assert.equal(upload.includes("createAIImageProvider"), false);
});
