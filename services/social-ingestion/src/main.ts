import { loadEnv, loadRepoEnv } from "@fused-ai/config";
import { createDatabaseClient } from "@fused-ai/database";
import { createSocialProvider } from "@fused-ai/social";

export async function runSocialIngestion() {
  loadRepoEnv();
  const env = loadEnv();
  const provider = createSocialProvider(env);
  const trending = await provider.trending();
  if (!trending.ok) return trending;
  const db = createDatabaseClient(env);
  if (env.databaseUrl) {
    await db.migrate();
    for (const post of trending.value.posts) await db.upsertSocialPost(post);
    const accounts = await provider.listTrackedAccounts();
    if (accounts.ok) {
      for (const account of accounts.value) await db.upsertTrackedAccount(account);
    }
    await db.markSocialSync("x", trending.value.posts.length);
  }
  await db.close();
  return trending;
}

const isMain = process.argv[1] && process.argv[1].endsWith("main.ts");
if (isMain) {
  void runSocialIngestion().then((result) => {
    console.error(JSON.stringify(result, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2));
    process.exit(result.ok ? 0 : 1);
  });
}
