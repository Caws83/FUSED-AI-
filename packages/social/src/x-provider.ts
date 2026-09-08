import type { Availability, SocialPost, TrackedAccount, TrendingFeed } from "@fused-ai/types";
import { fail, ok, type Result } from "@fused-ai/shared";
import type { FusedEnv } from "@fused-ai/config";
import { socialAvailability } from "@fused-ai/config";
import type { SocialProvider } from "./provider.ts";
import { loadTrackedAccounts } from "./registry.ts";
import { scorePosts } from "./trending.ts";
import { fetchTweetById, fetchUserTweets, resolveUsername } from "./x-api.ts";

export class XSocialProvider implements SocialProvider {
  readonly id = "x";
  private readonly env: FusedEnv;
  constructor(env: FusedEnv) {
    this.env = env;
  }

  availability(): Availability {
    return socialAvailability(this.env);
  }

  async getPost(postId: string): Promise<Result<SocialPost>> {
    const configured = this.availability();
    if (configured.status !== "OK") return fail(configured);
    return fetchTweetById(postId, this.env.social.bearerToken as string);
  }

  async listTrackedAccounts(): Promise<Result<readonly TrackedAccount[]>> {
    const loaded = await loadTrackedAccounts(this.env.social.trackedAccountsPath);
    if (!loaded.ok) return loaded;
    const bearer = this.env.social.bearerToken;
    if (!bearer) return loaded;
    const resolved: TrackedAccount[] = [];
    for (const account of loaded.value) {
      if (!account.enabled) {
        resolved.push(account);
        continue;
      }
      if (account.platformUserId) {
        resolved.push(account);
        continue;
      }
      const user = await resolveUsername(account.username, bearer);
      if (!user.ok) {
        resolved.push(account);
        continue;
      }
      resolved.push({
        ...account,
        platformUserId: user.value.id,
        username: user.value.username,
        displayName: user.value.name,
        updatedAt: new Date().toISOString(),
      });
    }
    return ok(resolved);
  }

  async fetchRecentPosts(account: TrackedAccount): Promise<Result<readonly SocialPost[]>> {
    const configured = this.availability();
    if (configured.status !== "OK") return fail(configured);
    let userId = account.platformUserId;
    if (!userId) {
      const user = await resolveUsername(account.username, this.env.social.bearerToken as string);
      if (!user.ok) return user;
      userId = user.value.id;
    }
    return fetchUserTweets(userId, this.env.social.bearerToken as string);
  }

  async trending(): Promise<Result<TrendingFeed>> {
    const configured = this.availability();
    if (configured.status !== "OK") return fail(configured);
    const accounts = await this.listTrackedAccounts();
    if (!accounts.ok) return accounts;
    const enabled = accounts.value.filter((a) => a.enabled);
    if (!enabled.length) {
      return ok({ posts: [], scores: [], fetchedAt: new Date().toISOString(), source: "x" });
    }
    const posts: SocialPost[] = [];
    const seen = new Set<string>();
    const priorityByAuthor = new Map<string, number>();
    for (const account of enabled) {
      priorityByAuthor.set(account.username.toLowerCase(), account.priority);
      const recent = await this.fetchRecentPosts(account);
      if (!recent.ok) continue;
      for (const post of recent.value) {
        if (seen.has(post.postId)) continue;
        seen.add(post.postId);
        posts.push(post);
      }
    }
    const scores = scorePosts(posts, Date.now(), this.env.social.weights, priorityByAuthor);
    const ranked = scores
      .map((score) => posts.find((p) => p.postId === score.postId))
      .filter((p): p is SocialPost => Boolean(p));
    return ok({
      posts: ranked,
      scores,
      fetchedAt: new Date().toISOString(),
      source: "x",
    });
  }
}

export function createSocialProvider(env: FusedEnv): SocialProvider {
  return new XSocialProvider(env);
}
