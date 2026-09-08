import type { Availability, SocialPost, TrackedAccount, TrendingFeed } from "@fused-ai/types";
import { providerUnavailable } from "@fused-ai/types";
import { fail, type Result } from "@fused-ai/shared";
import type { FusedEnv } from "@fused-ai/config";
import { socialAvailability } from "@fused-ai/config";
import type { SocialProvider } from "./provider.ts";
import { loadTrackedAccounts } from "./registry.ts";

/**
 * X/Twitter provider. When credentials are missing this returns NOT_CONFIGURED
 * and never fabricates posts. Live API calls are a later phase.
 */
export class XSocialProvider implements SocialProvider {
  readonly id = "x";
  private readonly env: FusedEnv;
  constructor(env: FusedEnv) {
    this.env = env;
  }

  availability(): Availability {
    const configured = socialAvailability(this.env);
    if (configured.status !== "OK") return configured;
    return providerUnavailable(
      "Social credentials are present but live X API ingestion is not implemented in Phase 1. Refusing to return mock posts.",
    );
  }

  async getPost(_postId: string): Promise<Result<SocialPost>> {
    return fail(this.availability());
  }

  async listTrackedAccounts(): Promise<Result<readonly TrackedAccount[]>> {
    const configured = socialAvailability(this.env);
    if (configured.status !== "OK") return fail(configured);
    return loadTrackedAccounts(this.env.social.trackedAccountsPath);
  }

  async fetchRecentPosts(_account: TrackedAccount): Promise<Result<readonly SocialPost[]>> {
    return fail(this.availability());
  }

  async trending(): Promise<Result<TrendingFeed>> {
    return fail(this.availability());
  }
}

export function createSocialProvider(env: FusedEnv): SocialProvider {
  const id = (env.social.provider ?? "x").toLowerCase();
  if (id === "x" || id === "twitter") return new XSocialProvider(env);
  return new XSocialProvider(env);
}
