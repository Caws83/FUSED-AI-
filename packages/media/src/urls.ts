const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isLocalChain(chainId: number | null | undefined): boolean {
  return chainId === 31337;
}

/** Persistent token media URLs must be public https except on the local Anvil chain. */
export function assertPublicMediaUrl(url: string, chainId: number | null): { ok: true } | { ok: false; reason: string } {
  if (!url) return { ok: false, reason: "Missing media URL." };
  if (url.startsWith("blob:") || url.startsWith("data:")) {
    return { ok: false, reason: "Temporary browser URLs cannot be stored as token media." };
  }
  if (url.startsWith("/api/media/") || url.startsWith("/brand/")) {
    if (isLocalChain(chainId)) return { ok: true };
    return { ok: false, reason: "Relative media URLs are only allowed on the local chain." };
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: "Invalid media URL." };
  }
  const host = parsed.hostname.toLowerCase();
  if (parsed.protocol === "http:" && isLocalChain(chainId) && LOCAL_HOSTS.has(host)) return { ok: true };
  if (parsed.protocol !== "https:") return { ok: false, reason: "Public token media must use https." };
  if (LOCAL_HOSTS.has(host) || host.endsWith(".local")) {
    if (isLocalChain(chainId)) return { ok: true };
    return { ok: false, reason: "Localhost media URLs are not allowed on a public chain." };
  }
  return { ok: true };
}
