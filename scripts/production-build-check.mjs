#!/usr/bin/env node
/**
 * Production-like Next build without loading gitignored local secrets.
 * Does not delete .env or .env.local.
 */
import { spawnSync } from "node:child_process";
import { repoRoot } from "./repo-env.mjs";

const root = repoRoot();
const env = { ...process.env };
for (const key of Object.keys(env)) {
  if (
    /^(DATABASE_URL|X_|AI_|AWS_|DEPLOYER_|RPC_URL|CHAIN_ID|LAUNCH_|UNISWAP_|MEDIA_|NEXT_PUBLIC_|SOCIAL_|PUBLIC_|FUSED_|BUCKET_|INDEXER_|TOKENIZED_)/.test(
      key,
    )
  ) {
    delete env[key];
  }
}
env.NODE_ENV = "production";
env.VERCEL = "1";
env.VERCEL_ENV = "production";
env.NEXT_PUBLIC_APP_URL = "https://fused-ai-web.vercel.app";

const result = spawnSync("npm", ["run", "build", "--workspace=@fused-ai/web"], {
  cwd: root,
  env,
  encoding: "utf8",
  shell: true,
});
process.stdout.write(result.stdout || "");
process.stderr.write(result.stderr || "");
process.exit(result.status ?? 1);
