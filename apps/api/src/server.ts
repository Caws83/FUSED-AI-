import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { loadEnv, loadRepoEnv, systemStatus } from "@fused-ai/config";
import { listDexAdapters } from "@fused-ai/blockchain";
import { createSocialProvider } from "@fused-ai/social";
import { createAIProvider } from "@fused-ai/ai";
import { createDatabaseClient } from "@fused-ai/database";

loadRepoEnv();
const env = loadEnv();

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://localhost");
  res.setHeader("content-type", "application/json");
  if (url.pathname === "/health") {
    res.end(JSON.stringify({ ok: true, service: "fused-ai-api", phase: 1 }));
    return;
  }
  if (url.pathname === "/status") {
    const social = createSocialProvider(env);
    const ai = createAIProvider(env);
    const db = createDatabaseClient(env);
    res.end(
      JSON.stringify({
        status: systemStatus(env),
        social: social.availability(),
        ai: ai.availability(),
        database: db.availability(),
        dex: listDexAdapters(env).map((a) => a.info()),
      }),
    );
    return;
  }
  if (url.pathname === "/v1/trending") {
    const social = createSocialProvider(env);
    const result = await social.trending();
    res.statusCode = result.ok ? 200 : 503;
    res.end(JSON.stringify(result.ok ? result.value : result.error));
    return;
  }
  if (url.pathname === "/v1/ai/generate" && req.method === "POST") {
    res.statusCode = 503;
    const ai = createAIProvider(env);
    res.end(JSON.stringify(ai.availability()));
    return;
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ status: "NOT_CONFIGURED", reason: "unknown route" }));
}

export function startApiServer(port = Number(process.env.API_PORT ?? 3001)) {
  const server = createServer((req, res) => {
    void handle(req, res);
  });
  return new Promise<{ close: () => Promise<void> }>((resolve) => {
    server.listen(port, () => {
      resolve({
        close: () =>
          new Promise((r) => {
            server.close(() => r());
          }),
      });
    });
  });
}

const isMain = process.argv[1] && process.argv[1].endsWith("server.ts");
if (isMain) {
  void startApiServer().then(() => {
    console.log(`fused-ai api listening on ${process.env.API_PORT ?? 3001}`);
  });
}
