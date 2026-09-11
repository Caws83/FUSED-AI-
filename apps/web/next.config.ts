import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(path.join(dir, ".env.example")) && existsSync(path.join(dir, "package.json"))) {
      return dir;
    }
    dir = path.resolve(dir, "..");
  }
  return start;
}

const configDir = path.dirname(fileURLToPath(import.meta.url));
const repoRootFromWalk = findRepoRoot(configDir);
const repoRootCandidate = path.resolve(configDir, "..", "..");
const repoRoot =
  existsSync(path.join(repoRootCandidate, "package.json")) &&
  existsSync(path.join(repoRootCandidate, "apps", "web", "package.json"))
    ? repoRootCandidate
    : repoRootFromWalk;

// Vercel injects env in the dashboard. Do not load gitignored local secrets there.
if (!process.env.VERCEL) {
  loadEnvConfig(repoRoot);
}

const nextConfig: NextConfig = {
  outputFileTracingRoot: repoRoot,
  outputFileTracingIncludes: {
    "/*": [
      "../../deployments/**/*.json",
      "../../deployments/**/*.example.json",
      "../../.env.example",
    ],
  },
  transpilePackages: [
    "@fused-ai/ai",
    "@fused-ai/blockchain",
    "@fused-ai/config",
    "@fused-ai/social",
    "@fused-ai/types",
    "@fused-ai/shared",
    "@fused-ai/validation",
    "@fused-ai/database",
    "@fused-ai/media",
    "@fused-ai/ui",
  ],
  serverExternalPackages: ["postgres"],
};

export default nextConfig;
