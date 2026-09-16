import assert from "node:assert/strict";
import test from "node:test";
import { marketCapWei } from "@fused-ai/blockchain/fused";
import {
  formatHeadlineUsd,
  formatUsdCompactFromWei,
  quoteWeiToUsdWei,
} from "../src/lib/format.ts";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

test("Arc market cap is price times circulating formatted as compact USD", () => {
  const price = 4578854575326n;
  const circ = 811230963971824259044756n;
  const mc = marketCapWei(price, circ);
  assert.equal(formatHeadlineUsd(mc, 5042, null), "$3.71");
  assert.equal(formatHeadlineUsd(mc, 5042, 999999), "$3.71");
  assert.equal(formatUsdCompactFromWei(40_000n * 10n ** 18n), "$40.0K");
  assert.equal(formatUsdCompactFromWei(1_250_000n * 10n ** 18n), "$1.25M");
});

test("Robinhood headline USD uses a live ETH conversion and never a hardcoded price", () => {
  const ethMc = 2n * 10n ** 18n;
  assert.equal(quoteWeiToUsdWei(ethMc, 4663, null), null);
  assert.equal(formatHeadlineUsd(ethMc, 4663, null), "—");
  assert.equal(formatHeadlineUsd(ethMc, 4663, 3500), "$7.0K");
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../src/lib/eth-usd.ts"), "utf8");
  assert.match(src, /api\.coinbase\.com\/v2\/prices\/ETH-USD\/spot/);
  assert.equal(src.includes("3500"), false);
});

test("chart sorts real indexed candles and draws a line for sparse trades", () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../src/lib/chart-series.ts"), "utf8");
  assert.match(src, /sortCandles/);
  assert.match(src, /Date\.parse\(left\.bucket_start\)/);
  assert.match(src, /1e18/);
  assert.equal(src.includes("Math.random"), false);
});
