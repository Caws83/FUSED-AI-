import { notConfigured, providerUnavailable } from "@fused-ai/types";
import { err, fail, ok, type Result } from "@fused-ai/shared";
import type { FusedEnv } from "@fused-ai/config";
import { aiImageAvailability } from "@fused-ai/config";

export type AIImageInput = {
  name: string;
  symbol: string;
  description?: string;
  imagePrompt?: string;
};

export type AIImageProvider = {
  generateTokenImage(input: AIImageInput): Promise<Result<{ bytes: Uint8Array; mime: string }>>;
};

export class UnavailableAIImageProvider implements AIImageProvider {
  async generateTokenImage(_input: AIImageInput): Promise<Result<{ bytes: Uint8Array; mime: string }>> {
    return fail(notConfigured(["AI_IMAGE_PROVIDER"], "AI image generation is not available."));
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * OpenAI-compatible images API. Prefers b64_json. Never fetches arbitrary image URLs.
 */
export class HttpAIImageProvider implements AIImageProvider {
  constructor(
    private readonly env: FusedEnv,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async generateTokenImage(input: AIImageInput): Promise<Result<{ bytes: Uint8Array; mime: string }>> {
    const ready = aiImageAvailability(this.env);
    if (ready.status !== "OK") return fail(ready);
    const key = this.env.aiImage.apiKey;
    if (!key) return fail(ready);
    const base = (this.env.aiImage.apiBaseUrl ?? this.env.ai.apiBaseUrl ?? "https://api.openai.com/v1").replace(
      /\/$/,
      "",
    );
    const model = this.env.aiImage.model ?? "dall-e-3";
    const prompt = [
      "Token logo, square, simple, no text unless part of a mark.",
      `Name: ${input.name}`,
      `Ticker: ${input.symbol}`,
      input.description ? `Description: ${input.description}` : "",
      input.imagePrompt ? `Art direction: ${input.imagePrompt}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    try {
      const res = await this.fetchImpl(`${base}/images/generations`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          prompt,
          n: 1,
          size: "1024x1024",
          response_format: "b64_json",
        }),
      });
      if (!res.ok) return err(providerUnavailable(`AI image HTTP ${res.status}.`));
      const body = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
      const b64 = body.data?.[0]?.b64_json;
      if (!b64) {
        return err(providerUnavailable("Image provider did not return b64_json. Refusing remote URLs."));
      }
      const bytes = Uint8Array.from(Buffer.from(b64, "base64"));
      return ok({ bytes, mime: "image/png" });
    } catch (error) {
      return err(providerUnavailable(error instanceof Error ? error.message : "AI image request failed."));
    }
  }
}

export function createAIImageProvider(env?: FusedEnv): AIImageProvider {
  if (!env) return new UnavailableAIImageProvider();
  if (aiImageAvailability(env).status !== "OK") return new UnavailableAIImageProvider();
  return new HttpAIImageProvider(env);
}
