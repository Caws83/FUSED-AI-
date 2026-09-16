export type Candle = {
  bucket_start: string;
  open_x18: string;
  high_x18: string;
  low_x18: string;
  close_x18: string;
  volume_quote: string;
};

export type PricePoint = {
  bucketStart: string;
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export function x18ToNumber(value: string): number {
  try {
    const parsed = Number(BigInt(value));
    return Number.isFinite(parsed) ? parsed / 1e18 : Number.NaN;
  } catch {
    return Number.NaN;
  }
}

export function sortCandles(candles: Candle[]): Candle[] {
  return candles
    .filter((candle) => Boolean(candle?.bucket_start))
    .slice()
    .sort((left, right) => {
      const a = Date.parse(left.bucket_start);
      const b = Date.parse(right.bucket_start);
      return (Number.isNaN(a) ? 0 : a) - (Number.isNaN(b) ? 0 : b);
    });
}

/** Real indexed candles only. Empty buckets are omitted — never synthesized. */
export function realPricePoints(candles: Candle[]): PricePoint[] {
  return sortCandles(candles)
    .map((candle) => ({
      bucketStart: candle.bucket_start,
      time: Date.parse(candle.bucket_start),
      open: x18ToNumber(candle.open_x18),
      high: x18ToNumber(candle.high_x18),
      low: x18ToNumber(candle.low_x18),
      close: x18ToNumber(candle.close_x18),
      volume: x18ToNumber(candle.volume_quote),
    }))
    .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.close));
}
