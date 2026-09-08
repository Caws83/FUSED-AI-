import { loadEnv, loadRepoEnv, launchContractsAvailability, rpcAvailability } from "@fused-ai/config";
import { createDatabaseClient } from "@fused-ai/database";
import { pollOnce } from "./sync.ts";

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
    console.log(JSON.stringify({ loop: true, intervalMs: env.indexer.intervalMs, ...once }));
    const tick = async () => {
      const result = await pollOnce(env, db);
      console.log(JSON.stringify(result));
    };
    setInterval(() => {
      void tick();
    }, env.indexer.intervalMs);
    return { ...once, loop: true };
  }

  await db.close();
  return { ...once, loop: false };
}

const isMain = process.argv[1] && /main\.ts$/.test(process.argv[1].replaceAll("\\", "/"));
if (isMain) {
  loadRepoEnv();
  void startIndexer().then((result) => {
    console.log(JSON.stringify(result, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2));
    if (!result.started) process.exit(1);
    if (!("loop" in result && result.loop)) process.exit(0);
  });
}
