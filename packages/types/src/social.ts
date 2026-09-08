export type SocialPlatform = "x" | "twitter" | "mastodon" | "farcaster";

export type TrackedAccount = {
  id: string;
  platform: SocialPlatform;
  platformUserId: string;
  username: string;
  displayName: string;
  enabled: boolean;
  category: string;
  priority: number;
  createdAt: string;
  updatedAt: string;
};

export type SocialMedia = {
  type: "photo" | "video" | "gif" | "link";
  url: string;
  previewUrl?: string;
  altText?: string;
  width?: number;
  height?: number;
};

export type SocialMetrics = {
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  views?: number;
  bookmarks?: number;
};

export type SocialPost = {
  platform: SocialPlatform;
  postId: string;
  authorId: string;
  authorUsername: string;
  text: string;
  url: string;
  media: readonly SocialMedia[];
  metrics: SocialMetrics;
  publishedAt: string;
  fetchedAt: string;
  language?: string;
};

export type TrendingWeights = {
  velocity: number;
  recency: number;
  totals: number;
};

export type TrendingScore = {
  postId: string;
  score: number;
  velocity: number;
  recency: number;
  totals: number;
  computedAt: string;
  weights: TrendingWeights;
};

export type TrendingFeed = {
  posts: readonly SocialPost[];
  scores: readonly TrendingScore[];
  fetchedAt: string;
  source: string;
};
