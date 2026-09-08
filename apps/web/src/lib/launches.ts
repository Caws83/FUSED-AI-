import { loadEnv, loadRepoEnv } from "@fused-ai/config";
import { createDatabaseClient } from "@fused-ai/database";
import type { IndexedLaunch } from "@fused-ai/types";

export async function loadIndexedLaunches(): Promise<IndexedLaunch[]> {
  loadRepoEnv();
  const env = loadEnv();
  if (!env.databaseUrl || !env.chainId) return [];
  const db = createDatabaseClient(env);
  const result = await db.listLaunches(env.chainId);
  await db.close();
  return result.ok ? result.value : [];
}

export async function loadIndexedLaunch(token: string): Promise<IndexedLaunch | null> {
  loadRepoEnv();
  const env = loadEnv();
  if (!env.databaseUrl || !env.chainId) return null;
  const db = createDatabaseClient(env);
  const result = await db.getLaunch(env.chainId, token);
  await db.close();
  return result.ok ? result.value : null;
}
