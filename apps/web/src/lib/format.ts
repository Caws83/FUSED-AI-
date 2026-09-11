export function formatEth(wei: string | bigint | null | undefined, digits = 4): string {
  if (wei == null) return "—";
  try {
    const value = BigInt(wei);
    const neg = value < 0n;
    const abs = neg ? -value : value;
    const whole = abs / 10n ** 18n;
    const frac = abs % 10n ** 18n;
    const fracStr = frac.toString().padStart(18, "0").slice(0, digits).replace(/0+$/, "");
    const shown = fracStr ? `${whole.toString()}.${fracStr}` : whole.toString();
    return `${neg ? "-" : ""}${shown} ETH`;
  } catch {
    return "—";
  }
}

export function formatToken(amount: string | bigint | null | undefined, digits = 2): string {
  if (amount == null) return "—";
  try {
    const value = BigInt(amount);
    const whole = value / 10n ** 18n;
    const frac = value % 10n ** 18n;
    if (whole >= 1_000_000n) return `${(Number(whole) / 1_000_000).toFixed(2)}M`;
    if (whole >= 1_000n) return `${(Number(whole) / 1_000).toFixed(2)}K`;
    const fracStr = frac.toString().padStart(18, "0").slice(0, digits).replace(/0+$/, "");
    return fracStr ? `${whole.toString()}.${fracStr}` : whole.toString();
  } catch {
    return "—";
  }
}

export function formatAge(iso: string | null, blockNumber: string | bigint): string {
  if (!iso) return `block ${blockNumber.toString()}`;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return new Date(iso).toLocaleString();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

export function shortAddr(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function explorerTx(chainId: number, hash: string): string | null {
  if (!hash || hash === "0x0000000000000000000000000000000000000000000000000000000000000000") return null;
  if (chainId === 31337) return null;
  if (chainId === 46630) return `https://explorer.testnet.chain.robinhood.com/tx/${hash}`;
  if (chainId === 4663) return `https://explorer.chain.robinhood.com/tx/${hash}`;
  if (chainId === 8453) return `https://basescan.org/tx/${hash}`;
  if (chainId === 1) return `https://etherscan.io/tx/${hash}`;
  return null;
}

export function progressFromLaunch(launch: {
  lifecycleState?: string | null;
  realQuote?: string | null;
  graduationTarget?: string | null;
}): number {
  if ((launch.lifecycleState ?? "").toUpperCase() === "GRADUATED") return 10000;
  try {
    const real = BigInt(launch.realQuote ?? "0");
    const target = BigInt(launch.graduationTarget ?? "0");
    if (target === 0n) return 0;
    const bps = (real * 10_000n) / target;
    return Number(bps > 10_000n ? 10_000n : bps);
  } catch {
    return 0;
  }
}

export function stateBadge(state: string | null | undefined, dexVersion: string): "CURVE" | "GRADUATED" {
  const s = (state ?? "").toUpperCase();
  if (s === "GRADUATED" || dexVersion === "uniswap_v4" || dexVersion === "v4") return "GRADUATED";
  return "CURVE";
}
