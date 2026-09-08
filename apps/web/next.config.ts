import type { NextConfig } from "next";

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
    "@fused-ai/ui",
  ],
};

export default nextConfig;
