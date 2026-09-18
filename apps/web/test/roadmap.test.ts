import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("footer links to the roadmap page", () => {
  const footer = readFileSync(join(root, "src/components/SiteFooter.tsx"), "utf8");
  assert.match(footer, /href="\/roadmap"/);
  assert.match(footer, />Roadmap</);
});

test("footer links to documentation", () => {
  const footer = readFileSync(join(root, "src/components/SiteFooter.tsx"), "utf8");
  assert.match(footer, /href="\/docs"/);
  assert.match(footer, />Docs</);
});

test("roadmap lists completed app launch, then token, Arc, X Money, and NFTs", () => {
  const page = readFileSync(join(root, "src/app/roadmap/page.tsx"), "utf8");
  assert.match(page, /App live on Robinhood Chain/);
  assert.match(page, /Token launch on Robinhood/);
  assert.match(page, /Launch on Arc Chain/);
  assert.match(page, /X Money/);
  assert.match(page, /original post creator/);
  assert.match(page, /NFTs from posts/);
  assert.match(page, /inspired by the post content/);
  assert.match(page, /status: "Completed"/);
  assert.match(page, /tone: "green"/);
  assert.match(page, /status: "Next"/);
  assert.equal(page.includes('status: "Done"'), false);
});
