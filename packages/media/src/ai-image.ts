import { notConfigured, providerUnavailable } from "@fused-ai/types";
import { clampText, err, fail, ok, type Result } from "@fused-ai/shared";
import type { FusedEnv } from "@fused-ai/config";
import { aiImageAvailability } from "@fused-ai/config";
import type { MediaStore } from "./store.ts";
import { validateImage } from "./validate.ts";

export type AIImageInput = {
  name: string;
  symbol: string;
  description?: string;
  imagePrompt?: string;
};

export type AIImageProvider = {
  generateTokenImage(input: AIImageInput): Promise<Result<{ bytes: Uint8Array; mime: string }>>;
};

export type GeneratedLogo = {
  id: string;
  url: string;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const NAME_MAX = 32;
const SYMBOL_MAX = 11;
const DESCRIPTION_MAX = 500;
const PROMPT_MAX = 400;
const DEFAULT_MODEL = "gpt-image-2";
const LOGO_SIZE = "1024x1024";

export class UnavailableAIImageProvider implements AIImageProvider {
  async generateTokenImage(_input: AIImageInput): Promise<Result<{ bytes: Uint8Array; mime: string }>> {
    return fail(notConfigured(["AI_IMAGE_PROVIDER"], "AI logo generation is not configured."));
  }
}

/**
 * OpenAI-compatible images API. Prefers b64_json. Never fetches arbitrary image URLs.
 */
export class HttpAIImageProvider implements AIImageProvider {
  private readonly env: FusedEnv;
  private readonly fetchImpl: FetchLike;

  constructor(env: FusedEnv, fetchImpl: FetchLike = fetch) {
    this.env = env;
    this.fetchImpl = fetchImpl;
  }

  async generateTokenImage(input: AIImageInput): Promise<Result<{ bytes: Uint8Array; mime: string }>> {
    const ready = aiImageAvailability(this.env);
    if (ready.status !== "OK") return fail(ready);
    const key = this.env.aiImage.apiKey;
    if (!key) return fail(ready);
    const base = (this.env.aiImage.apiBaseUrl ?? this.env.ai.apiBaseUrl ?? "https://api.openai.com/v1").replace(
      /\/$/,
      "",
    );
    const model = this.env.aiImage.model || DEFAULT_MODEL;
    const prompt = buildLogoPrompt(input);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.env.aiImage.timeoutMs);
    try {
      const res = await this.fetchImpl(`${base}/images/generations`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(imageRequestBody(model, prompt)),
        signal: controller.signal,
      });
      if (!res.ok) return err(providerUnavailable(`AI image provider failed (${res.status}).`));
      const body = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
      const b64 = body.data?.[0]?.b64_json;
      if (!b64) {
        return err(providerUnavailable("Image provider did not return b64_json. Refusing remote URLs."));
      }
      let bytes: Uint8Array;
      try {
        bytes = Uint8Array.from(Buffer.from(b64, "base64"));
      } catch {
        return err(providerUnavailable("Image provider returned invalid image data."));
      }
      const checked = validateImage(bytes);
      if (!checked.ok) return err(providerUnavailable(checked.reason));
      return ok({ bytes: checked.value.bytes, mime: checked.value.mime });
    } catch (error) {
      return err(providerUnavailable(safeImageError(error)));
    } finally {
      clearTimeout(timer);
    }
  }
}

export function createAIImageProvider(env?: FusedEnv, fetchImpl?: FetchLike): AIImageProvider {
  if (!env) return new UnavailableAIImageProvider();
  if (aiImageAvailability(env).status !== "OK") return new UnavailableAIImageProvider();
  return new HttpAIImageProvider(env, fetchImpl ?? fetch);
}

export function normalizeAIImageInput(input: AIImageInput): Result<AIImageInput> {
  const name = clampText(input.name ?? "", NAME_MAX);
  const symbol = clampText(input.symbol ?? "", SYMBOL_MAX);
  if (!name || !symbol) {
    return err({ status: "NOT_CONFIGURED", reason: "Name and ticker are required." });
  }
  return ok({
    name,
    symbol,
    description: input.description ? clampText(input.description, DESCRIPTION_MAX) : undefined,
    imagePrompt: input.imagePrompt ? clampText(input.imagePrompt, PROMPT_MAX) : undefined,
  });
}

export async function generateAndStoreTokenLogo(
  env: FusedEnv,
  input: AIImageInput,
  options: { store: MediaStore; fetchImpl?: FetchLike; provider?: AIImageProvider },
): Promise<Result<GeneratedLogo>> {
  const normalized = normalizeAIImageInput(input);
  if (!normalized.ok) return normalized;
  const provider = options.provider ?? createAIImageProvider(env, options.fetchImpl);
  const generated = await provider.generateTokenImage(normalized.value);
  if (!generated.ok) return generated;
  const checked = validateImage(generated.value.bytes, generated.value.mime);
  if (!checked.ok) return err(providerUnavailable(checked.reason));
  const saved = await options.store.uploadTokenImage(checked.value);
  if (!saved.ok) return saved;
  const url = options.store.getPublicUrl(saved.value.id);
  if (!url) return err(providerUnavailable("Generated logo is missing a public URL."));
  return ok({ id: saved.value.id, url });
}

export function aiImageRouteError(error: { status: string; reason?: string; missing?: readonly string[] }): string {
  if (error.status === "NOT_CONFIGURED") {
    if (error.missing?.some((key) => key.startsWith("AI_"))) return "AI logo generation is not configured.";
    return error.reason || "AI logo generation is not configured.";
  }
  return safeReason(error.reason || "AI logo generation failed.");
}

function buildLogoPrompt(input: AIImageInput): string {
  return [
    "Create a square cryptocurrency token logo. Centered mark, high contrast, no watermark, no photorealistic faces, no letters unless they form a simple monogram.",
    `Token name: ${input.name}`,
    `Ticker: ${input.symbol}`,
    input.description ? `Description: ${input.description}` : "",
    input.imagePrompt ? `Requested theme: ${input.imagePrompt}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function imageRequestBody(model: string, prompt: string): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model,
    prompt,
    size: LOGO_SIZE,
  };
  if (/^dall-e-/i.test(model)) {
    body.n = 1;
    body.response_format = "b64_json";
  }
  return body;
}

function safeImageError(error: unknown): string {
  const text = error instanceof Error ? error.message : "AI image request failed.";
  if (error instanceof Error && error.name === "AbortError") return "AI logo generation timed out.";
  if (/aborted|timeout|TimeoutError/i.test(text)) return "AI logo generation timed out.";
  return safeReason(text);
}

function safeReason(text: string): string {
  if (/sk-|api[_-]?key|bearer\s+[a-z0-9._-]+/i.test(text)) return "AI image request failed.";
  return text.slice(0, 180);
}
