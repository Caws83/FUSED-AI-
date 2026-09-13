import type { LaunchCategory, LaunchDraft, LaunchDraftValidationIssue, SuggestedLaunchConfig } from "@fused-ai/types";
import { clampText, sanitizeHttpUrl } from "@fused-ai/shared";

const CATEGORIES = new Set<LaunchCategory>(["meme", "community", "finance", "technology", "culture", "other"]);
const TICKER = /^[A-Z0-9]{2,12}$/;
const NAME = /^[\p{L}\p{N} ._\-]{2,64}$/u;

function issue(path: string, code: string, message: string): LaunchDraftValidationIssue {
  return { path, code, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/**
 * AI output is never trusted. This parser accepts unknown JSON and either
 * returns a validated LaunchDraft or a list of issues. It does not fill in
 * marketing defaults.
 */
export function parseLaunchDraft(input: unknown): {
  draft: LaunchDraft | null;
  issues: LaunchDraftValidationIssue[];
} {
  const issues: LaunchDraftValidationIssue[] = [];
  if (!isRecord(input)) {
    return { draft: null, issues: [issue("$", "not_object", "Launch draft must be an object")] };
  }

  const nameRaw = str(input.name);
  const tickerRaw = str(input.ticker) ?? str(input.symbol);
  const descriptionRaw = str(input.description);
  const imageConceptRaw = str(input.imageConcept) ?? str(input.imagePrompt);
  const categoryRaw = str(input.category);
  const model = str(input.model);
  const provider = str(input.provider);
  const generatedAt = str(input.generatedAt);
  const sourcePost = isRecord(input.sourcePost) ? input.sourcePost : null;

  if (!nameRaw || !NAME.test(clampText(nameRaw, 64))) {
    issues.push(issue("name", "invalid_name", "name must be 2–64 letters/numbers/space/._-"));
  }
  const ticker = tickerRaw ? tickerRaw.trim().toUpperCase() : "";
  if (!TICKER.test(ticker)) {
    issues.push(issue("ticker", "invalid_ticker", "ticker must be 2–12 A–Z / 0–9"));
  }
  if (!descriptionRaw || clampText(descriptionRaw, 500).length < 8) {
    issues.push(issue("description", "invalid_description", "description must be 8–500 characters"));
  }
  if (!imageConceptRaw || clampText(imageConceptRaw, 400).length < 4) {
    issues.push(issue("imageConcept", "invalid_image_concept", "imageConcept must be 4–400 characters"));
  }
  if (!categoryRaw || !CATEGORIES.has(categoryRaw as LaunchCategory)) {
    issues.push(issue("category", "invalid_category", "category is not in the allowed set"));
  }
  if (!model || model.length > 80) issues.push(issue("model", "invalid_model", "model id required"));
  if (!provider || provider.length > 40) issues.push(issue("provider", "invalid_provider", "provider id required"));
  if (!generatedAt || Number.isNaN(Date.parse(generatedAt))) {
    issues.push(issue("generatedAt", "invalid_timestamp", "generatedAt must be an ISO timestamp"));
  }

  const platform = sourcePost ? str(sourcePost.platform) : null;
  const postId = sourcePost ? str(sourcePost.postId) : null;
  const url = sourcePost ? str(sourcePost.url) : null;
  const safeUrl = url ? sanitizeHttpUrl(url) : null;
  if (!platform || !["x", "twitter", "mastodon", "farcaster"].includes(platform)) {
    issues.push(issue("sourcePost.platform", "invalid_platform", "source post platform required"));
  }
  if (!postId || postId.length > 128) {
    issues.push(issue("sourcePost.postId", "invalid_post_id", "source post id required"));
  }
  if (!safeUrl) {
    issues.push(issue("sourcePost.url", "invalid_url", "source post url must be http(s)"));
  }

  const suggested = parseSuggestedConfig(input.suggestedConfig, issues);

  if (issues.length > 0) return { draft: null, issues };

  const draft: LaunchDraft = {
    name: clampText(nameRaw!, 64),
    ticker,
    description: clampText(descriptionRaw!, 500),
    imageConcept: clampText(imageConceptRaw!, 400),
    category: categoryRaw as LaunchCategory,
    suggestedConfig: suggested!,
    sourcePost: {
      platform: platform as LaunchDraft["sourcePost"]["platform"],
      postId: postId!,
      url: safeUrl!,
    },
    model: model!,
    provider: provider!,
    generatedAt: generatedAt!,
  };
  return { draft, issues: [] };
}

function parseSuggestedConfig(
  value: unknown,
  issues: LaunchDraftValidationIssue[],
): SuggestedLaunchConfig | null {
  if (!isRecord(value)) {
    issues.push(issue("suggestedConfig", "invalid_config", "suggestedConfig must be an object"));
    return null;
  }
  const quoteAssetId = value.quoteAssetId === null ? null : str(value.quoteAssetId);
  if (quoteAssetId !== null && (typeof quoteAssetId !== "string" || quoteAssetId.length > 128)) {
    issues.push(issue("suggestedConfig.quoteAssetId", "invalid_quote", "quoteAssetId must be string or null"));
  }
  const lpFeePips = value.lpFeePips;
  if (typeof lpFeePips !== "number" || !Number.isInteger(lpFeePips) || lpFeePips < 0 || lpFeePips > 30_000) {
    issues.push(issue("suggestedConfig.lpFeePips", "invalid_fee", "lpFeePips must be 0–30000"));
  }
  const startTick = value.startTick === null ? null : value.startTick;
  if (startTick !== null && (typeof startTick !== "number" || !Number.isInteger(startTick))) {
    issues.push(issue("suggestedConfig.startTick", "invalid_tick", "startTick must be int or null"));
  }
  const recipientMode = str(value.recipientMode);
  if (!recipientMode || !["creator", "burn", "split"].includes(recipientMode)) {
    issues.push(issue("suggestedConfig.recipientMode", "invalid_recipients", "recipientMode invalid"));
  }
  if (issues.some((i) => i.path.startsWith("suggestedConfig"))) return null;
  return {
    quoteAssetId,
    lpFeePips: lpFeePips as number,
    startTick: startTick as number | null,
    recipientMode: recipientMode as SuggestedLaunchConfig["recipientMode"],
  };
}

/** Detect likely prompt-injection / instruction-override payloads in post text. */
export function detectPromptInjection(text: string): string[] {
  const hits: string[] = [];
  const patterns: Array<[RegExp, string]> = [
    [/ignore.{0,40}(instructions|prompts)/i, "ignore_instructions"],
    [/system\s*prompt/i, "system_prompt"],
    [/you are now /i, "role_override"],
    [/<\/?system>/i, "system_tag"],
    [/\bdo not validate\b/i, "bypass_validation"],
    [/reveal.{0,40}(api key|secret|token|private key)/i, "reveal_secret"],
    [/output.{0,40}(api key|secret|token|private key)/i, "reveal_secret"],
    [/\bprivate key\b/i, "reveal_secret"],
    [/change.{0,40}contract address/i, "change_contract"],
    [/\bsend (all )?(funds|eth|tokens)\b/i, "send_funds"],
  ];
  for (const [re, code] of patterns) {
    if (re.test(text)) hits.push(code);
  }
  return [...new Set(hits)];
}
