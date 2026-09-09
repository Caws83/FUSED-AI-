import { loadEnv } from "@fused-ai/config";
import { createAIProvider } from "@fused-ai/ai";

export function aiLaunchStatus(env = loadEnv()) {
  return createAIProvider(env).availability();
}

const isMain = process.argv[1] && process.argv[1].endsWith("main.ts");
if (isMain) {
  const status = aiLaunchStatus();
  console.error(JSON.stringify(status, null, 2));
  process.exit(status.status === "OK" ? 0 : 1);
}
