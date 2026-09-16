import assert from "node:assert/strict";
import test from "node:test";
import {
  TOKEN_OG_ART,
  TOKEN_OG_SIZE,
  absoluteMediaUrl,
  rasterDataUri,
  sniffOgImageMime,
} from "../src/lib/token-og.ts";

test("token OG canvas matches the 1200×630 share-card standard", () => {
  assert.equal(TOKEN_OG_SIZE.width, 1200);
  assert.equal(TOKEN_OG_SIZE.height, 630);
  assert.ok(TOKEN_OG_ART < TOKEN_OG_SIZE.height);
  assert.ok(TOKEN_OG_ART < TOKEN_OG_SIZE.width);
});

test("absoluteMediaUrl keeps https images and prefixes relative ones", () => {
  assert.equal(
    absoluteMediaUrl("https://cdn.example.com/a.png", "https://fused.ai"),
    "https://cdn.example.com/a.png",
  );
  assert.equal(
    absoluteMediaUrl("/brand/fused-token.svg", "https://fused.ai"),
    "https://fused.ai/brand/fused-token.svg",
  );
  assert.equal(
    absoluteMediaUrl("/brand/fused-token.svg", "https://fused.ai/"),
    "https://fused.ai/brand/fused-token.svg",
  );
});

test("sniffOgImageMime detects PNG and rejects SVG", () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(sniffOgImageMime(png), "image/png");
  assert.ok(rasterDataUri(png)?.startsWith("data:image/png;base64,"));
  assert.equal(sniffOgImageMime(Uint8Array.from([0x3c, 0x73, 0x76, 0x67])), null);
});
