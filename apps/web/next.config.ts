import { existsSync } from "node:fs";
import path from "node:path";
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

loadEnvConfig(findRepoRoot(process.cwd()));

const nextConfig: NextConfig = {
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
};

export default nextConfig;
