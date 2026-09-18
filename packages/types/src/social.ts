export type SocialPlatform = "x" | "twitter" | "mastodon" | "farcaster" | "fused";

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

/** File-registry row. platformUserId may be empty until the provider resolves it. */
export type TrackedAccountConfig = {
  platform: SocialPlatform;
  username: string;
  category: string;
  enabled: boolean;
  priority: number;
  platformUserId?: string;
  displayName?: string;
  id?: string;
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
  likes?: number;
  replies?: number;
  reposts?: number;
  quotes?: number;
  views?: number;
  bookmarks?: number;
};

/** Optional public nickname/PFP for a wallet. Canonical identity is the address. */
export type FusedProfile = {
  walletAddress: string;
  displayName: string | null;
  pfpUrl: string | null;
  nonce: number;
};

export type SocialPost = {
  platform: SocialPlatform;
  postId: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName?: string;
  /** Live overlay from fused_profiles.display_name. Not stored on the post. */
  profileDisplayName?: string;
  avatarUrl?: string;
  verified?: boolean;
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
  priority: number;
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
