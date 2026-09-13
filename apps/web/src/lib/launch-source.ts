import { findXPostInText, parseXPostUrl, xPostUrl } from "@fused-ai/social/x-url";
import { clampText } from "@fused-ai/shared";

export type LaunchSource = {
  sourcePlatform: string | null;
  sourcePostId: string | null;
  sourceAuthor: string | null;
  sourcePostUrl: string | null;
  sourceExcerpt: string | null;
};

const EMPTY_SOURCE: LaunchSource = {
  sourcePlatform: null,
  sourcePostId: null,
  sourceAuthor: null,
  sourcePostUrl: null,
  sourceExcerpt: null,
};

export function launchSourceFromText(text: string): LaunchSource {
  const excerpt = clampText(text.trim(), 240);
  const found = findXPostInText(text);
  if (!found) {
    return excerpt ? { ...EMPTY_SOURCE, sourceExcerpt: excerpt } : EMPTY_SOURCE;
  }
  return {
    sourcePlatform: "x",
    sourcePostId: found.postId,
    sourceAuthor: found.username,
    sourcePostUrl: xPostUrl(found),
    sourceExcerpt: excerpt || null,
  };
}

export function launchSourceFromPayload(extra: Record<string, unknown>): LaunchSource {
  const excerpt = typeof extra.sourceExcerpt === "string" ? clampText(extra.sourceExcerpt, 240) : "";
  const rawUrl = typeof extra.sourcePostUrl === "string" ? extra.sourcePostUrl : "";
  const rawAuthor = typeof extra.sourceAuthor === "string" ? extra.sourceAuthor.replace(/^@/, "") : "";
  const parsed = parseXPostUrl(rawUrl) ?? findXPostInText(rawUrl);
  if (!parsed) {
    return excerpt ? { ...EMPTY_SOURCE, sourceExcerpt: excerpt } : EMPTY_SOURCE;
  }
  return {
    sourcePlatform: "x",
    sourcePostId: parsed.postId,
    sourceAuthor: clampText(parsed.username || rawAuthor, 32) || parsed.username,
    sourcePostUrl: xPostUrl(parsed),
    sourceExcerpt: excerpt || null,
  };
}
