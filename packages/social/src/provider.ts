import type { Availability, SocialPost, TrackedAccount, TrendingFeed } from "@fused-ai/types";
import type { Result } from "@fused-ai/shared";

export type SocialProvider = {
  readonly id: string;
  availability(): Availability;
  getPost(postId: string): Promise<Result<SocialPost>>;
  listTrackedAccounts(): Promise<Result<readonly TrackedAccount[]>>;
  fetchRecentPosts(account: TrackedAccount): Promise<Result<readonly SocialPost[]>>;
  trending(): Promise<Result<TrendingFeed>>;
};
