/** Live ETH/USD spot. Null when the feed is unavailable — never a hardcoded price. */
let cached: { at: number; usd: number | null } = { at: 0, usd: null };

export async function fetchEthUsd(): Promise<number | null> {
  if (Date.now() - cached.at < 60_000) return cached.usd;
  try {
    const res = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot", {
      next: { revalidate: 60 },
    });
    const json = (await res.json()) as { data?: { amount?: string } };
    const usd = Number(json.data?.amount);
    cached = { at: Date.now(), usd: Number.isFinite(usd) && usd > 0 ? usd : null };
  } catch {
    cached = { at: Date.now(), usd: cached.usd };
  }
  return cached.usd;
}
