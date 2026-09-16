import { sanitizeHttpUrl } from "@fused-ai/shared";

export type XPostRef = {
  username: string;
  postId: string;
};

const HOSTS = new Set(["x.com", "www.x.com", "twitter.com", "www.twitter.com"]);
const PATH = /^\/([A-Za-z0-9_]{1,15})\/status\/(\d{1,25})\/?$/;

export function parseXPostUrl(input: string): XPostRef | null {
  const cleaned = sanitizeHttpUrl(input, 500);
  if (!cleaned) return null;
  let url: URL;
  try {
    url = new URL(cleaned);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (!HOSTS.has(url.hostname.toLowerCase())) return null;
  const match = url.pathname.match(PATH);
  if (!match) return null;
  return { username: match[1] ?? "", postId: match[2] ?? "" };
}

export function xStatusUrl(ref: XPostRef): string {
  return `https://x.com/${ref.username}/status/${ref.postId}`;
}

const URL_IN_TEXT = /https:\/\/(?:www\.)?(?:x|twitter)\.com\/[^\s<>"']+/gi;

export function extractXPostUrl(text: string): XPostRef | null {
  const found = text.match(URL_IN_TEXT) ?? [];
  for (const raw of found) {
    const trimmed = raw.replace(/[)\].,;:!?]+$/g, "");
    const parsed = parseXPostUrl(trimmed);
    if (parsed) return parsed;
  }
  return null;
}

export function originXPostHref(input: {
  url?: string | null;
  postId?: string | null;
  username?: string | null;
  platform?: string | null;
}): string | null {
  if (input.url) {
    const parsed = parseXPostUrl(input.url) ?? extractXPostUrl(input.url);
    if (parsed) return xStatusUrl(parsed);
  }
  const platform = (input.platform ?? "x").toLowerCase();
  if (input.platform && platform !== "x" && platform !== "twitter") return null;
  const id = input.postId?.trim() ?? "";
  if (!/^\d{1,25}$/.test(id)) return null;
  const user = (input.username ?? "").replace(/^@/, "").trim();
  if (user && /^[A-Za-z0-9_]{1,15}$/.test(user)) return xStatusUrl({ username: user, postId: id });
  return `https://x.com/i/status/${id}`;
}
