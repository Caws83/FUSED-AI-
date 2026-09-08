import type { Availability, LaunchDraft, SocialPost, ValidatedLaunchDraft } from "@fused-ai/types";
import type { Result } from "@fused-ai/shared";

export type AIProvider = {
  readonly id: string;
  availability(): Availability;
  generateLaunchFromPost(post: SocialPost): Promise<Result<ValidatedLaunchDraft>>;
  generateTokenMetadata(draft: LaunchDraft): Promise<Result<{ description: string; imageConcept: string }>>;
  validateGeneratedLaunch(raw: unknown): Result<LaunchDraft>;
};
