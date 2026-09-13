import assert from "node:assert/strict";
import test from "node:test";
import { objectPublicUrl } from "../src/object-store.ts";
import {
  FUSED_TOKEN_IMAGE_FALLBACK,
  readLaunchSyncImage,
  resolvePersistedLaunchImage,
  tokenImageSrc,
} from "../src/token-image.ts";

const CHAIN = 46630;
const AI_ID = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1.png";
const MANUAL_ID = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb2.webp";
const PUBLIC_BASE = "https://cdn.example.com";

test("AI-generated R2 imageId + imageUrl survive launch/sync resolution", () => {
  const extra = readLaunchSyncImage({
    imageId: AI_ID,
    imageUrl: `${PUBLIC_BASE}/${AI_ID}`,
    logo: "https://evil.example/logo.png",
    logoUrl: "https://evil.example/logo.png",
  });
  const resolved = resolvePersistedLaunchImage(extra, {
    chainId: CHAIN,
    publicUrlForId: (id) => objectPublicUrl(PUBLIC_BASE, id),
  });
  assert.equal(resolved.imageId, AI_ID);
  assert.equal(resolved.imageUrl, `${PUBLIC_BASE}/${AI_ID}`);
});

test("manual R2 imageId + imageUrl survive launch/sync resolution", () => {
  const extra = readLaunchSyncImage({
    imageId: MANUAL_ID,
    imageUrl: `${PUBLIC_BASE}/${MANUAL_ID}`,
  });
  const resolved = resolvePersistedLaunchImage(extra, {
    chainId: CHAIN,
    publicUrlForId: (id) => objectPublicUrl(PUBLIC_BASE, id),
  });
  assert.equal(resolved.imageId, MANUAL_ID);
  assert.equal(resolved.imageUrl, `${PUBLIC_BASE}/${MANUAL_ID}`);
});

test("imageId alone reconstructs a validated public URL", () => {
  const resolved = resolvePersistedLaunchImage(
    { imageId: AI_ID },
    { chainId: CHAIN, publicUrlForId: (id) => objectPublicUrl(PUBLIC_BASE, id) },
  );
  assert.equal(resolved.imageUrl, `${PUBLIC_BASE}/${AI_ID}`);
});

test("invalid image URLs are rejected and fall back safely", () => {
  const rejected = resolvePersistedLaunchImage(
    { imageId: "../secret.png", imageUrl: "blob:https://x/1" },
    { chainId: CHAIN, publicUrlForId: (id) => objectPublicUrl(PUBLIC_BASE, id) },
  );
  assert.equal(rejected.imageUrl, null);
  assert.equal(tokenImageSrc("javascript:alert(1)", CHAIN), FUSED_TOKEN_IMAGE_FALLBACK);
  assert.equal(tokenImageSrc("http://localhost:3000/a.png", CHAIN), FUSED_TOKEN_IMAGE_FALLBACK);
  assert.equal(tokenImageSrc("/api/media/abc.png", CHAIN), FUSED_TOKEN_IMAGE_FALLBACK);
  assert.equal(tokenImageSrc(null, CHAIN), FUSED_TOKEN_IMAGE_FALLBACK);
  assert.equal(tokenImageSrc(`${PUBLIC_BASE}/${AI_ID}`, CHAIN), `${PUBLIC_BASE}/${AI_ID}`);
});
