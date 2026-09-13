import type { FusePostDraft, LaunchDraftValidationIssue } from "@fused-ai/types";
import { clampText } from "@fused-ai/shared";

const NAME = /^[\p{L}\p{N} ._\-]{1,32}$/u;
const TICKER = /^[A-Z0-9]{1,11}$/;

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
 * Strict V1 fuse schema. Does not invent fields and does not accept source URLs.
 */
export function parseFusePostDraft(input: unknown): {
  draft: FusePostDraft | null;
  issues: LaunchDraftValidationIssue[];
} {
  const issues: LaunchDraftValidationIssue[] = [];
  if (!isRecord(input)) {
    return { draft: null, issues: [issue("$", "not_object", "Fuse draft must be an object")] };
  }

  const nameRaw = str(input.name);
  const tickerRaw = str(input.ticker) ?? str(input.symbol);
  const descriptionRaw = str(input.description);
  const logoPromptRaw = str(input.logoPrompt) ?? str(input.imagePrompt) ?? str(input.imageConcept);

  const name = nameRaw ? clampText(nameRaw, 32) : "";
  if (!name || !NAME.test(name)) {
    issues.push(issue("name", "invalid_name", "name must be 1–32 letters, numbers, spaces, or ._-"));
  }

  const ticker = tickerRaw ? tickerRaw.trim().toUpperCase() : "";
  if (!TICKER.test(ticker)) {
    issues.push(issue("ticker", "invalid_ticker", "ticker must be 1–11 A–Z or 0–9"));
  }

  const description = descriptionRaw ? clampText(descriptionRaw, 500) : "";
  if (description.length < 8) {
    issues.push(issue("description", "invalid_description", "description must be 8–500 characters"));
  }

  const logoPrompt = logoPromptRaw ? clampText(logoPromptRaw, 400) : "";
  if (logoPrompt.length < 4) {
    issues.push(issue("logoPrompt", "invalid_logo_prompt", "logoPrompt must be 4–400 characters"));
  }

  if (issues.length > 0) return { draft: null, issues };
  return { draft: { name, ticker, description, logoPrompt }, issues: [] };
}

export const FUSE_POST_TEXT_MAX = 2_000;
