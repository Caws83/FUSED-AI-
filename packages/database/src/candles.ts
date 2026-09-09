/** Unix-aligned candle bucket. Intervals: 60, 300, 900, 3600. */
export const CANDLE_INTERVALS = [60, 300, 900, 3600] as const;

export function candleBucketStart(at: Date, intervalSec: number): Date {
  const ts = Math.floor(at.getTime() / 1000);
  const start = Math.floor(ts / intervalSec) * intervalSec;
  return new Date(start * 1000);
}
