import type { SocialPost, TrendingScore, TrendingWeights } from "@fused-ai/types";

function n(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function engagement(post: SocialPost): number {
  const m = post.metrics;
  return n(m.likes) + n(m.replies) * 2 + n(m.reposts) * 2 + n(m.quotes) * 3 + n(m.views) * 0.001;
}

/**
 * Fused AI Trending — deterministic score from real posts only.
 * This is not X's ranking algorithm.
 */
export function scorePosts(
  posts: readonly SocialPost[],
  nowMs: number,
  weights: TrendingWeights,
  priorityByUsername: ReadonlyMap<string, number> = new Map(),
): TrendingScore[] {
  const computedAt = new Date(nowMs).toISOString();
  return posts
    .map((post) => {
      const published = Date.parse(post.publishedAt);
      const ageHours = Math.max((nowMs - published) / 3_600_000, 1 / 60);
      const totalsRaw = engagement(post);
      const velocity = totalsRaw / ageHours;
      const recency = Math.exp(-ageHours / 24);
      const totals = Math.log1p(totalsRaw);
      const priority = (priorityByUsername.get(post.authorUsername.toLowerCase()) ?? 0) / 10_000;
      const score =
        weights.velocity * velocity +
        weights.recency * recency +
        weights.totals * totals +
        (weights.priority ?? 0) * priority;
      return {
        postId: post.postId,
        score,
        velocity,
        recency,
        totals,
        computedAt,
        weights,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function formatEngagement(post: SocialPost): string {
  const parts: string[] = [];
  if (post.metrics.likes != null) parts.push(`${post.metrics.likes} likes`);
  if (post.metrics.reposts != null) parts.push(`${post.metrics.reposts} reposts`);
  if (post.metrics.replies != null) parts.push(`${post.metrics.replies} replies`);
  if (post.metrics.views != null) parts.push(`${post.metrics.views} views`);
  return parts.join(" · ") || "—";
}
