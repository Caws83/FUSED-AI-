import type { SocialMedia, SocialPost, TrackedAccount } from "@fused-ai/types";
import { clampText, sanitizeHttpUrl } from "@fused-ai/shared";

const PLATFORMS = new Set(["x", "twitter", "mastodon", "farcaster"]);
const EPOCH = "1970-01-01T00:00:00.000Z";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalMetric(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined;
  return Math.floor(value);
}

export function parseTrackedAccount(input: unknown): TrackedAccount | null {
  if (!isRecord(input)) return null;
  const platform = typeof input.platform === "string" ? input.platform.toLowerCase() : "";
  const username = typeof input.username === "string" ? input.username.replace(/^@/, "") : "";
  const category = typeof input.category === "string" ? input.category : "";
  const enabled = input.enabled === true;
  const priority = typeof input.priority === "number" && Number.isInteger(input.priority) ? input.priority : null;
  if (!PLATFORMS.has(platform)) return null;
  if (!/^[A-Za-z0-9_]{1,32}$/.test(username)) return null;
  if (!category || category.length > 64) return null;
  if (priority === null || priority < 0 || priority > 10_000) return null;

  const platformUserId = typeof input.platformUserId === "string" ? input.platformUserId.trim() : "";
  if (platformUserId && platformUserId.length > 128) return null;
  const displayName = typeof input.displayName === "string" ? input.displayName : "";
  const id =
    typeof input.id === "string" && input.id.trim()
      ? input.id.trim()
      : `${platform}:${username.toLowerCase()}`;
  if (id.length > 128) return null;
  const createdAt = typeof input.createdAt === "string" && !Number.isNaN(Date.parse(input.createdAt)) ? input.createdAt : EPOCH;
  const updatedAt = typeof input.updatedAt === "string" && !Number.isNaN(Date.parse(input.updatedAt)) ? input.updatedAt : EPOCH;
  return {
    id,
    platform: platform as TrackedAccount["platform"],
    platformUserId,
    username,
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
    const key = account.platformUserId
      ? `${account.platform}:${account.platformUserId}`
      : `${account.platform}:@${account.username.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(account);
  }
  return out;
}

function parseMedia(input: unknown): SocialMedia[] {
  if (!Array.isArray(input)) return [];
  const out: SocialMedia[] = [];
  for (const item of input) {
    if (!isRecord(item)) continue;
    const type = item.type;
    if (type !== "photo" && type !== "video" && type !== "gif" && type !== "link") continue;
    const url = typeof item.url === "string" ? sanitizeHttpUrl(item.url, 2_000) : null;
    if (!url) continue;
    const preview = typeof item.previewUrl === "string" ? sanitizeHttpUrl(item.previewUrl, 2_000) : undefined;
    out.push({
      type,
      url,
      previewUrl: preview ?? undefined,
      altText: typeof item.altText === "string" ? clampText(item.altText, 280) : undefined,
      width: typeof item.width === "number" ? item.width : undefined,
      height: typeof item.height === "number" ? item.height : undefined,
    });
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
  const avatarUrl = typeof input.avatarUrl === "string" ? sanitizeHttpUrl(input.avatarUrl, 2_000) : null;
  return {
    platform: platform as SocialPost["platform"],
    postId,
    authorId,
    authorUsername: clampText(authorUsername, 32),
    authorDisplayName: typeof input.authorDisplayName === "string" ? clampText(input.authorDisplayName, 80) : undefined,
    avatarUrl: avatarUrl ?? undefined,
    verified: input.verified === true ? true : input.verified === false ? false : undefined,
    text: clampText(text, 8_000),
    url,
    media: parseMedia(input.media),
    metrics: {
      likes: optionalMetric(metrics.likes),
      replies: optionalMetric(metrics.replies),
      reposts: optionalMetric(metrics.reposts),
      quotes: optionalMetric(metrics.quotes),
      views: optionalMetric(metrics.views),
      bookmarks: optionalMetric(metrics.bookmarks),
    },
    publishedAt,
    fetchedAt,
    language: typeof input.language === "string" ? clampText(input.language, 16) : undefined,
  };
}
