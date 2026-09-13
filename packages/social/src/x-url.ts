import { sanitizeHttpUrl } from "@fused-ai/shared";

export type XPostRef = {
  username: string;
  postId: string;
};

const HOSTS = new Set(["x.com", "www.x.com", "twitter.com", "www.twitter.com"]);
const PATH = /^\/([A-Za-z0-9_]{1,15})\/status\/(\d{1,25})\/?$/;

const URL_IN_TEXT = /(?:https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\/[A-Za-z0-9_]{1,15}\/status\/\d{1,25}/gi;

export function xPostUrl(ref: XPostRef): string {
  return `https://x.com/${ref.username}/status/${ref.postId}`;
}

export function findXPostInText(text: string): XPostRef | null {
  const matches = text.match(URL_IN_TEXT);
  if (!matches) return null;
  for (const raw of matches) {
    const href = raw.startsWith("http") ? raw.replace(/^http:/i, "https:") : `https://${raw}`;
    const parsed = parseXPostUrl(href);
    if (parsed) return parsed;
  }
  return null;
}

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
