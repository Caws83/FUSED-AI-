const ADDRESS = /^0x[a-fA-F0-9]{40}$/;

export function shortenAddress(value: string): string {
  const address = value.trim();
  if (!ADDRESS.test(address)) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function relativeTime(iso: string, nowMs = Date.now()): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const seconds = Math.max(0, Math.floor((nowMs - then) / 1000));
  if (seconds < 60) return `${Math.max(1, seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
