import { loadEnv, launchContractsAvailability, rpcAvailability } from "@fused-ai/config";
import { createDatabaseClient } from "@fused-ai/database";

export async function startIndexer() {
  const env = loadEnv();
  const db = createDatabaseClient(env);
  const checks = [db.availability(), rpcAvailability(env), launchContractsAvailability(env)];
  const blocked = checks.find((c) => c.status !== "OK");
  if (blocked) {
    return { started: false as const, reason: blocked };
  }
  return {
    started: false as const,
    reason: {
      status: "RPC_UNAVAILABLE" as const,
      reason: "Indexer event loop is not implemented in Phase 1. Refusing to write synthetic launch rows.",
    },
  };
}

const isMain = process.argv[1] && process.argv[1].endsWith("main.ts");
if (isMain) {
  void startIndexer().then((result) => {
    console.error(JSON.stringify(result, null, 2));
    process.exit(result.started ? 0 : 1);
  });
}
