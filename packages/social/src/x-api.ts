import type { SocialMedia, SocialPost } from "@fused-ai/types";
import { providerUnavailable } from "@fused-ai/types";
import { err, ok, type Result } from "@fused-ai/shared";
import { sanitizeHttpUrl } from "@fused-ai/shared";
import { parseSocialPost } from "@fused-ai/validation";

const API = "https://api.twitter.com/2";
const TWEET_FIELDS = "created_at,public_metrics,lang,author_id,attachments";
const USER_FIELDS = "username,name,profile_image_url,verified,verified_type";
const MEDIA_FIELDS = "url,preview_image_url,type,width,height,alt_text";
const EXPANSIONS = "author_id,attachments.media_keys";

type Tweet = {
  id?: string;
  text?: string;
  author_id?: string;
  created_at?: string;
  lang?: string;
  attachments?: { media_keys?: string[] };
  public_metrics?: {
    like_count?: number;
    reply_count?: number;
    retweet_count?: number;
    quote_count?: number;
    impression_count?: number;
    bookmark_count?: number;
  };
};

type User = {
  id?: string;
  username?: string;
  name?: string;
  profile_image_url?: string;
  verified?: boolean;
  verified_type?: string;
};

type Media = {
  media_key?: string;
  type?: string;
  url?: string;
  preview_image_url?: string;
  width?: number;
  height?: number;
  alt_text?: string;
};

export async function xGet<T>(path: string, bearer: string): Promise<Result<T>> {
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      headers: { authorization: `Bearer ${bearer}`, accept: "application/json" },
    });
  } catch (error) {
    return err(providerUnavailable(error instanceof Error ? error.message : "X API request failed"));
  }
  if (response.status === 401 || response.status === 403) {
    return err(providerUnavailable("X API rejected the configured credentials."));
  }
  if (!response.ok) {
    return err(providerUnavailable(`X API returned ${response.status}.`));
  }
  try {
    return ok((await response.json()) as T);
  } catch {
    return err(providerUnavailable("X API returned invalid JSON."));
  }
}

function mediaType(type: string | undefined): SocialMedia["type"] | null {
  if (type === "photo") return "photo";
  if (type === "video") return "video";
  if (type === "animated_gif") return "gif";
  return null;
}

export function normalizeTweet(
  tweet: Tweet,
  users: readonly User[],
  media: readonly Media[],
  fetchedAt: string,
): SocialPost | null {
  const author = users.find((u) => u.id === tweet.author_id) ?? users[0];
  const username = author?.username ?? "";
  const keys = new Set(tweet.attachments?.media_keys ?? []);
  const attached: SocialMedia[] = [];
  for (const item of media) {
    if (item.media_key && !keys.has(item.media_key)) continue;
    const kind = mediaType(item.type);
    const url = item.url ? sanitizeHttpUrl(item.url, 2_000) : item.preview_image_url ? sanitizeHttpUrl(item.preview_image_url, 2_000) : null;
    if (!kind || !url) continue;
    const preview = item.preview_image_url ? sanitizeHttpUrl(item.preview_image_url, 2_000) : null;
    attached.push({
      type: kind,
      url,
      previewUrl: preview ?? undefined,
      altText: item.alt_text,
      width: item.width,
      height: item.height,
    });
  }
  const metrics = tweet.public_metrics ?? {};
  const verified =
    author?.verified === true || author?.verified_type === "blue" || author?.verified_type === "government"
      ? true
      : author?.verified === false
        ? false
        : undefined;
  return parseSocialPost({
    platform: "x",
    postId: tweet.id,
    authorId: tweet.author_id,
    authorUsername: username,
    authorDisplayName: author?.name,
    avatarUrl: author?.profile_image_url,
    verified,
    text: tweet.text ?? "",
    url: username && tweet.id ? `https://x.com/${username}/status/${tweet.id}` : "",
    media: attached,
    metrics: {
      likes: metrics.like_count,
      replies: metrics.reply_count,
      reposts: metrics.retweet_count,
      quotes: metrics.quote_count,
      views: metrics.impression_count,
      bookmarks: metrics.bookmark_count,
    },
    publishedAt: tweet.created_at,
    fetchedAt,
    language: tweet.lang,
  });
}

export async function fetchTweetById(postId: string, bearer: string): Promise<Result<SocialPost>> {
  if (!/^\d{1,25}$/.test(postId)) {
    return err({ status: "NOT_CONFIGURED", reason: "Invalid post id." });
  }
  const path = `/tweets/${postId}?expansions=${EXPANSIONS}&tweet.fields=${TWEET_FIELDS}&user.fields=${USER_FIELDS}&media.fields=${MEDIA_FIELDS}`;
  const result = await xGet<{ data?: Tweet; includes?: { users?: User[]; media?: Media[] } }>(path, bearer);
  if (!result.ok) return result;
  const post = normalizeTweet(result.value.data ?? {}, result.value.includes?.users ?? [], result.value.includes?.media ?? [], new Date().toISOString());
  if (!post) return err(providerUnavailable("X API returned a tweet that could not be normalized."));
  return ok(post);
}

export async function resolveUsername(username: string, bearer: string): Promise<Result<{ id: string; username: string; name: string }>> {
  const handle = username.replace(/^@/, "");
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) {
    return err({ status: "NOT_CONFIGURED", reason: "Invalid username." });
  }
  const result = await xGet<{ data?: User }>(`/users/by/username/${encodeURIComponent(handle)}?user.fields=${USER_FIELDS}`, bearer);
  if (!result.ok) return result;
  const user = result.value.data;
  if (!user?.id || !user.username) return err(providerUnavailable("X user was not found."));
  return ok({ id: user.id, username: user.username, name: user.name ?? user.username });
}

export async function fetchUserTweets(userId: string, bearer: string): Promise<Result<SocialPost[]>> {
  if (!/^\d{1,25}$/.test(userId)) {
    return err({ status: "NOT_CONFIGURED", reason: "Invalid user id." });
  }
  const path = `/users/${userId}/tweets?max_results=10&exclude=retweets,replies&expansions=${EXPANSIONS}&tweet.fields=${TWEET_FIELDS}&user.fields=${USER_FIELDS}&media.fields=${MEDIA_FIELDS}`;
  const result = await xGet<{ data?: Tweet[]; includes?: { users?: User[]; media?: Media[] } }>(path, bearer);
  if (!result.ok) return result;
  const fetchedAt = new Date().toISOString();
  const posts: SocialPost[] = [];
  for (const tweet of result.value.data ?? []) {
    const post = normalizeTweet(tweet, result.value.includes?.users ?? [], result.value.includes?.media ?? [], fetchedAt);
    if (post) posts.push(post);
  }
  return ok(posts);
}
