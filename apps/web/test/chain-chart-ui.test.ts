import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { realPricePoints, sortCandles, x18ToNumber } from "../src/lib/chart-series.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("chain badges are keyed only by indexed chainId", () => {
  const card = readFileSync(join(root, "../../packages/ui/src/LaunchCard.tsx"), "utf8");
  const boards = readFileSync(join(root, "src/lib/boards.tsx"), "utf8");
  const terminal = readFileSync(join(root, "src/components/TokenTerminal.tsx"), "utf8");
  const badge = readFileSync(join(root, "../../packages/ui/src/ChainBadge.tsx"), "utf8");
  assert.match(badge, /chainId === 5042\) return "Arc"/);
  assert.match(badge, /chainId === 4663\) return "Robinhood"/);
  assert.match(boards, /chainId:\s*launch\.chainId/);
  assert.match(card, /ChainBadge chainId=\{chainId\}/);
  assert.match(terminal, /ChainBadge chainId=\{chainId\}/);
  assert.equal(badge.includes("token.address"), false);
  assert.equal(card.includes("infer"), false);
});

test("chart series keeps real indexed closes and never invents buckets", () => {
  const unsorted = [
    {
      bucket_start: "2026-09-16T12:02:00.000Z",
      open_x18: "2000000000000000000",
      high_x18: "2000000000000000000",
      low_x18: "2000000000000000000",
      close_x18: "2000000000000000000",
      volume_quote: "1",
    },
    {
      bucket_start: "2026-09-16T12:00:00.000Z",
      open_x18: "1000000000000000000",
      high_x18: "1000000000000000000",
      low_x18: "1000000000000000000",
      close_x18: "1000000000000000000",
      volume_quote: "1",
    },
  ];
  const sorted = sortCandles(unsorted);
  assert.equal(sorted[0].bucket_start, "2026-09-16T12:00:00.000Z");
  assert.equal(x18ToNumber("4578854575326"), 4578854575326 / 1e18);
  const points = realPricePoints(unsorted);
  assert.equal(points.length, 2);
  assert.equal(points[0].close, 1);
  assert.equal(points[1].close, 2);
  const chart = readFileSync(join(root, "src/components/CandleChart.tsx"), "utf8");
  assert.equal(chart.includes("Math.random"), false);
  assert.equal(chart.includes("candleWidth"), false);
  assert.equal(chart.includes("volumeHeight"), false);
  assert.match(chart, /realPricePoints/);
  assert.match(chart, /lineJoin/);
});
