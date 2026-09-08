import type { Availability, LaunchDraft, SocialPost, ValidatedLaunchDraft } from "@fused-ai/types";
import { providerUnavailable } from "@fused-ai/types";
import { err, fail, ok, type Result } from "@fused-ai/shared";
import type { FusedEnv } from "@fused-ai/config";
import { aiAvailability } from "@fused-ai/config";
import { detectPromptInjection, parseLaunchDraft } from "@fused-ai/validation";
import type { AIProvider } from "./provider.ts";
import { buildLaunchPrompt } from "./prompt.ts";

/**
 * Env-selected provider. Phase 1 does not call a vendor. If credentials are
 * missing → NOT_CONFIGURED. If they are present → PROVIDER_UNAVAILABLE until
 * a real HTTP client is implemented. Never returns a fabricated draft.
 */
export class EnvAIProvider implements AIProvider {
  readonly id: string;
  private readonly env: FusedEnv;
  constructor(env: FusedEnv) {
    this.env = env;
    this.id = env.ai.provider ?? "unconfigured";
  }

  availability(): Availability {
    const configured = aiAvailability(this.env);
    if (configured.status !== "OK") return configured;
    return providerUnavailable(
      `AI provider "${this.env.ai.provider}" is selected but no vendor client is implemented in Phase 1. Refusing to invent a launch draft.`,
    );
  }

  async generateLaunchFromPost(post: SocialPost): Promise<Result<ValidatedLaunchDraft>> {
    const flags = detectPromptInjection(post.text);
    buildLaunchPrompt(post.text, flags);
    return fail(this.availability());
  }

  async generateTokenMetadata(_draft: LaunchDraft): Promise<Result<{ description: string; imageConcept: string }>> {
    return fail(this.availability());
  }

  validateGeneratedLaunch(raw: unknown): Result<LaunchDraft> {
    const parsed = parseLaunchDraft(raw);
    if (!parsed.draft) {
      return err({
        status: "PROVIDER_UNAVAILABLE",
        reason: `Launch draft failed schema validation: ${parsed.issues.map((i) => i.path).join(", ")}`,
      });
    }
    return ok(parsed.draft);
  }
}

export function createAIProvider(env: FusedEnv): AIProvider {
  return new EnvAIProvider(env);
}
