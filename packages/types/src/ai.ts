import type { SocialPost } from "./social.ts";

export type LaunchCategory =
  | "meme"
  | "community"
  | "finance"
  | "technology"
  | "culture"
  | "other";

export type SuggestedLaunchConfig = {
  quoteAssetId: string | null;
  lpFeePips: number;
  startTick: number | null;
  recipientMode: "creator" | "burn" | "split";
};

export type LaunchDraft = {
  name: string;
  ticker: string;
  description: string;
  imageConcept: string;
  category: LaunchCategory;
  suggestedConfig: SuggestedLaunchConfig;
  sourcePost: {
    platform: SocialPost["platform"];
    postId: string;
    url: string;
  };
  model: string;
  provider: string;
  generatedAt: string;
};

export type LaunchDraftValidationIssue = {
  path: string;
  message: string;
  code: string;
};

export type ValidatedLaunchDraft = {
  draft: LaunchDraft;
  issues: readonly LaunchDraftValidationIssue[];
};
