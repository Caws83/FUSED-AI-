import { notConfigured } from "@fused-ai/types";
import { fail, type Result } from "@fused-ai/shared";

export type AIImageInput = {
  name: string;
  symbol: string;
  description?: string;
};

export type AIImageProvider = {
  generateTokenImage(input: AIImageInput): Promise<Result<{ bytes: Uint8Array; mime: string }>>;
};

export class UnavailableAIImageProvider implements AIImageProvider {
  async generateTokenImage(_input: AIImageInput): Promise<Result<{ bytes: Uint8Array; mime: string }>> {
    return fail(notConfigured(["AI_IMAGE_PROVIDER"], "AI image generation is not available."));
  }
}

export function createAIImageProvider(): AIImageProvider {
  return new UnavailableAIImageProvider();
}
