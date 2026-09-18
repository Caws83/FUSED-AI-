import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("docs page covers fuse, launch, trade, graduate, rewards, and networks", () => {
  const page = readFileSync(join(root, "src/app/docs/page.tsx"), "utf8");
  assert.match(page, /How FUSED works/);
  assert.match(page, /Fuse a post/);
  assert.match(page, /Your wallet creates the token/);
  assert.match(page, /Buy and sell/);
  assert.match(page, /Locked liquidity on Uniswap/);
  assert.match(page, /Creator curve rewards/);
  assert.match(page, /Robinhood Mainnet/);
  assert.match(page, /Arc Mainnet/);
  assert.match(page, /AI never holds keys/);
  assert.match(page, /href="\/roadmap"/);
  assert.match(page, /href="\/community"/);
  assert.match(page, />Community</);
});
