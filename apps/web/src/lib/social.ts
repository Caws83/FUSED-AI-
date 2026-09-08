import { loadEnv, loadRepoEnv, socialAvailability } from "@fused-ai/config";
import { createDatabaseClient } from "@fused-ai/database";
import { createSocialProvider } from "@fused-ai/social";
import type { SocialPost } from "@fused-ai/types";

export async function loadSourcePost(postId: string | undefined): Promise<SocialPost | null> {
  if (!postId || !/^\d{1,25}$/.test(postId)) return null;
  loadRepoEnv();
  const env = loadEnv();
  const db = createDatabaseClient(env);
  if (env.databaseUrl) {
    await db.migrate();
    const cached = await db.getSocialPost("x", postId);
    if (cached.ok && cached.value) {
      await db.close();
      return cached.value;
    }
  }
  if (socialAvailability(env).status !== "OK") {
    await db.close();
    return null;
  }
  const fetched = await createSocialProvider(env).getPost(postId);
  if (fetched.ok && env.databaseUrl) await db.upsertSocialPost(fetched.value);
  await db.close();
  return fetched.ok ? fetched.value : null;
}

export async function loadTrendingPosts(): Promise<SocialPost[]> {
  loadRepoEnv();
  const env = loadEnv();
  if (socialAvailability(env).status !== "OK") return [];
  const provider = createSocialProvider(env);
  const feed = await provider.trending();
  if (!feed.ok) return [];
  const db = createDatabaseClient(env);
  if (env.databaseUrl) {
    await db.migrate();
    for (const post of feed.value.posts) await db.upsertSocialPost(post);
    await db.markSocialSync("x", feed.value.posts.length);
  }
  await db.close();
  return [...feed.value.posts];
}
