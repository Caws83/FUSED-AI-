import type { SocialPost, TrendingScore, TrendingWeights } from "@fused-ai/types";

function engagement(post: SocialPost): number {
  const m = post.metrics;
  return m.likes + m.replies * 2 + m.reposts * 2 + m.quotes * 3 + (m.views ?? 0) * 0.001;
}

/**
 * Deterministic score from real posts. Does not invent posts.
 * velocity uses engagement / ageHours; recency decays over 24h; totals is log1p(engagement).
 */
export function scorePosts(
  posts: readonly SocialPost[],
  nowMs: number,
  weights: TrendingWeights,
): TrendingScore[] {
  const computedAt = new Date(nowMs).toISOString();
  return posts.map((post) => {
    const published = Date.parse(post.publishedAt);
    const ageHours = Math.max((nowMs - published) / 3_600_000, 1 / 60);
    const totalsRaw = engagement(post);
    const velocity = totalsRaw / ageHours;
    const recency = Math.exp(-ageHours / 24);
    const totals = Math.log1p(totalsRaw);
    const score = weights.velocity * velocity + weights.recency * recency + weights.totals * totals;
    return {
      postId: post.postId,
      score,
      velocity,
      recency,
      totals,
      computedAt,
      weights,
    };
  }).sort((a, b) => b.score - a.score);
}
