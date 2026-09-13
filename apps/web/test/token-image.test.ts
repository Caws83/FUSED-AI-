import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  FUSED_TOKEN_IMAGE_FALLBACK,
  readLaunchSyncImage,
  resolvePersistedLaunchImage,
  tokenImageSrc,
} from "@fused-ai/media/token-image";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const R2_AI = "https://cdn.example.com/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1.png";
const R2_MANUAL = "https://cdn.example.com/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb2.webp";

test("AI-generated R2 image survives the launch/sync payload fields", () => {
  const extra = readLaunchSyncImage({ imageId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1.png", imageUrl: R2_AI });
  const resolved = resolvePersistedLaunchImage(extra, { chainId: 46630 });
  assert.equal(resolved.imageUrl, R2_AI);
});

test("manual R2 image survives the launch/sync payload fields", () => {
  const extra = readLaunchSyncImage({ imageId: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb2.webp", imageUrl: R2_MANUAL });
  const resolved = resolvePersistedLaunchImage(extra, { chainId: 46630 });
  assert.equal(resolved.imageUrl, R2_MANUAL);
});

test("token detail and listing render a persisted image URL", () => {
  assert.equal(tokenImageSrc(R2_AI, 46630), R2_AI);
  const terminal = readFileSync(join(root, "src/components/TokenTerminal.tsx"), "utf8");
  const boards = readFileSync(join(root, "src/lib/boards.tsx"), "utf8");
  const home = readFileSync(join(root, "src/app/page.tsx"), "utf8");
  const explore = readFileSync(join(root, "src/app/explore/page.tsx"), "utf8");
  assert.match(terminal, /tokenImageSrc\(launch\.imageUrl/);
  assert.match(boards, /tokenImageSrc\(launch\.imageUrl/);
  assert.match(home, /LaunchGrid/);
  assert.match(explore, /LaunchGrid/);
  assert.match(home, /boards\.live/);
  assert.match(home, /boards\.graduated/);
});

test("missing image uses the FUSED fallback", () => {
  assert.equal(tokenImageSrc(null, 46630), FUSED_TOKEN_IMAGE_FALLBACK);
  assert.equal(tokenImageSrc("", 46630), FUSED_TOKEN_IMAGE_FALLBACK);
});

test("invalid image URL is rejected and falls back safely", () => {
  assert.equal(tokenImageSrc("blob:https://x/1", 46630), FUSED_TOKEN_IMAGE_FALLBACK);
  assert.equal(tokenImageSrc("http://localhost:3000/secret.png", 46630), FUSED_TOKEN_IMAGE_FALLBACK);
  assert.equal(tokenImageSrc("javascript:alert(1)", 46630), FUSED_TOKEN_IMAGE_FALLBACK);
});

test("launch form posts imageId and imageUrl after a successful create", () => {
  const manual = readFileSync(join(root, "src/components/ManualLaunch.tsx"), "utf8");
  const sync = readFileSync(join(root, "src/app/api/launch/sync/route.ts"), "utf8");
  assert.match(manual, /imageId,/);
  assert.match(manual, /imageUrl: imagePreview/);
  assert.match(sync, /readLaunchSyncImage/);
  assert.match(sync, /upsertTokenMetadata/);
});
