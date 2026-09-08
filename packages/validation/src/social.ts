import type { SocialPost, TrackedAccount } from "@fused-ai/types";
import { clampText, sanitizeHttpUrl } from "@fused-ai/shared";

const PLATFORMS = new Set(["x", "twitter", "mastodon", "farcaster"]);
const ID = /^[A-Za-z0-9_\-:]{1,128}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseTrackedAccount(input: unknown): TrackedAccount | null {
  if (!isRecord(input)) return null;
  const id = typeof input.id === "string" ? input.id : "";
  const platform = typeof input.platform === "string" ? input.platform : "";
  const platformUserId = typeof input.platformUserId === "string" ? input.platformUserId : "";
  const username = typeof input.username === "string" ? input.username : "";
  const displayName = typeof input.displayName === "string" ? input.displayName : "";
  const category = typeof input.category === "string" ? input.category : "";
  const enabled = input.enabled === true;
  const priority = typeof input.priority === "number" && Number.isInteger(input.priority) ? input.priority : null;
  const createdAt = typeof input.createdAt === "string" ? input.createdAt : "";
  const updatedAt = typeof input.updatedAt === "string" ? input.updatedAt : "";
  if (!ID.test(id)) return null;
  if (!PLATFORMS.has(platform)) return null;
  if (!platformUserId || platformUserId.length > 128) return null;
  if (!/^[A-Za-z0-9_]{1,32}$/.test(username.replace(/^@/, ""))) return null;
  if (!category || category.length > 64) return null;
  if (priority === null || priority < 0 || priority > 10_000) return null;
  if (Number.isNaN(Date.parse(createdAt)) || Number.isNaN(Date.parse(updatedAt))) return null;
  return {
    id,
    platform: platform as TrackedAccount["platform"],
    platformUserId,
    username: username.replace(/^@/, ""),
    displayName: clampText(displayName || username, 80),
    enabled,
    category: clampText(category, 64),
    priority,
    createdAt,
    updatedAt,
  };
}

export function parseTrackedAccounts(input: unknown): TrackedAccount[] {
  if (!Array.isArray(input)) return [];
  const out: TrackedAccount[] = [];
  const seen = new Set<string>();
  for (const row of input) {
    const account = parseTrackedAccount(row);
    if (!account) continue;
    const key = `${account.platform}:${account.platformUserId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(account);
  }
  return out;
}

export function parseSocialPost(input: unknown): SocialPost | null {
  if (!isRecord(input)) return null;
  const platform = typeof input.platform === "string" ? input.platform : "";
  const postId = typeof input.postId === "string" ? input.postId : "";
  const authorId = typeof input.authorId === "string" ? input.authorId : "";
  const authorUsername = typeof input.authorUsername === "string" ? input.authorUsername : "";
  const text = typeof input.text === "string" ? input.text : "";
  const url = typeof input.url === "string" ? sanitizeHttpUrl(input.url) : null;
  const publishedAt = typeof input.publishedAt === "string" ? input.publishedAt : "";
  const fetchedAt = typeof input.fetchedAt === "string" ? input.fetchedAt : "";
  if (!PLATFORMS.has(platform) || !postId || !authorId || !url) return null;
  if (Number.isNaN(Date.parse(publishedAt)) || Number.isNaN(Date.parse(fetchedAt))) return null;
  const metrics = isRecord(input.metrics) ? input.metrics : {};
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  return {
    platform: platform as SocialPost["platform"],
    postId,
    authorId,
    authorUsername: clampText(authorUsername, 32),
    text: clampText(text, 8_000),
    url,
    media: [],
    metrics: {
      likes: num(metrics.likes),
      replies: num(metrics.replies),
      reposts: num(metrics.reposts),
      quotes: num(metrics.quotes),
      views: typeof metrics.views === "number" ? num(metrics.views) : undefined,
    },
    publishedAt,
    fetchedAt,
  };
}
