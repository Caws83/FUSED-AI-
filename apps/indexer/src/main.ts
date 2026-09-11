import { loadEnv, loadRepoEnv, launchContractsAvailability, rpcAvailability } from "@fused-ai/config";
import { createDatabaseClient } from "@fused-ai/database";
import { pollOnce } from "./sync.ts";

export function jsonSafe(value: unknown): string {
  return JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function startIndexer() {
  const env = loadEnv();
  const db = createDatabaseClient(env);
  const checks = [db.availability(), rpcAvailability(env), launchContractsAvailability(env)];
  const blocked = checks.find((c) => c.status !== "OK");
  if (blocked) {
    return { started: false as const, reason: blocked };
  }

  const once = await pollOnce(env, db);
  if (!once.started) return { started: false as const, reason: once.reason };

  if (env.indexer.syncLoop) {
    console.log(jsonSafe({ loop: true, intervalMs: env.indexer.intervalMs, ...once }));
    for (;;) {
      await sleep(env.indexer.intervalMs);
      try {
        const result = await pollOnce(env, db);
        console.log(jsonSafe(result));
      } catch (error) {
        console.log(
          jsonSafe({
            started: false,
            reconnect: true,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    }
  }

  await db.close();
  return { ...once, loop: false };
}

const isMain = process.argv[1] && /main\.ts$/.test(process.argv[1].replaceAll("\\", "/"));
if (isMain) {
  loadRepoEnv();
  void startIndexer().then((result) => {
    console.log(jsonSafe(result));
    if (!result.started) process.exit(1);
    if (!("loop" in result && result.loop)) process.exit(0);
  });
}
