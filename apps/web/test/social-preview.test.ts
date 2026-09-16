import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const layout = readFileSync(join(root, "src/app/layout.tsx"), "utf8");
const ogImage = readFileSync(join(root, "public/brand/og-1200x630.png"));

test("root metadata uses the production FUSED AI social preview", () => {
  assert.match(layout, /metadataBase:\s*new URL\(SITE_URL\)/);
  assert.match(layout, /https:\/\/www\.fusedai\.org/);
  assert.match(layout, /FUSED AI — Launch Tokens From Posts/);
  assert.match(layout, /Turn a post into a token with AI\. Create, launch and trade through the FUSED bonding curve\./);
  assert.match(layout, /canonical:\s*`\$\{SITE_URL\}\/`/);
  assert.match(layout, /type:\s*"website"/);
  assert.match(layout, /siteName:\s*"FUSED AI"/);
  assert.match(layout, /card:\s*"summary_large_image"/);
  assert.match(layout, /\/brand\/og-1200x630\.png/);
  assert.match(layout, /icons:\s*\{\s*icon:\s*"\/brand\/favicon\.png"/);
});

test("Open Graph image is a public 1200x630 PNG", () => {
  assert.equal(ogImage.subarray(0, 8).toString("binary"), "\x89PNG\r\n\x1a\n");
  assert.equal(ogImage.readUInt32BE(16), 1200);
  assert.equal(ogImage.readUInt32BE(20), 630);
});
