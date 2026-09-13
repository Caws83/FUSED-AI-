import { createAIProvider, type AIProvider } from "@fused-ai/ai";
import type { FusedEnv } from "@fused-ai/config";
import {
  aiImageRouteError,
  createAIImageProvider,
  createMediaStore,
  generateAndStoreTokenLogo,
  type AIImageProvider,
  type MediaStore,
} from "@fused-ai/media";
import { clampText } from "@fused-ai/shared";
import type { FusePostDraft } from "@fused-ai/types";
import { FUSE_POST_TEXT_MAX } from "@fused-ai/validation";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type FusePostSuccess = {
  ok: true;
  draft: FusePostDraft;
  image: { id: string; url: string } | null;
  imageError: string | null;
};

export type FusePostFailure = {
  ok: false;
  error: string;
  status: number;
};

export type FusePostResult = FusePostSuccess | FusePostFailure;

/**
 * One text completion, then one logo generation. No hidden retries.
 * Image failure keeps the text draft.
 */
export async function runFusePost(
  env: FusedEnv,
  text: string,
  options: {
    store?: MediaStore;
    fetchImpl?: FetchLike;
    ai?: AIProvider;
    imageProvider?: AIImageProvider;
  } = {},
): Promise<FusePostResult> {
  const clipped = clampText(text, FUSE_POST_TEXT_MAX);
  if (clipped.length < 8) {
    return { ok: false, error: "Paste a post with at least 8 characters.", status: 400 };
  }

  const ai = options.ai ?? createAIProvider(env, options.fetchImpl);
  const draftResult = await ai.generateLaunchFromPastedText(clipped);
  if (!draftResult.ok) {
    return {
      ok: false,
      error: fuseTextError(draftResult.error),
      status: draftResult.error.status === "NOT_CONFIGURED" ? 503 : 502,
    };
  }

  const draft = draftResult.value.draft;
  const imageResult = await generateAndStoreTokenLogo(
    env,
    {
      name: draft.name,
      symbol: draft.ticker,
      description: draft.description,
      imagePrompt: draft.logoPrompt,
    },
    {
      store: options.store ?? createMediaStore(env),
      fetchImpl: options.fetchImpl,
      provider: options.imageProvider ?? createAIImageProvider(env, options.fetchImpl),
    },
  );

  if (!imageResult.ok) {
    return {
      ok: true,
      draft,
      image: null,
      imageError: aiImageRouteError(imageResult.error),
    };
  }

  return {
    ok: true,
    draft,
    image: imageResult.value,
    imageError: null,
  };
}

export function fuseTextError(error: { status: string; reason?: string; missing?: readonly string[] }): string {
  if (error.status === "NOT_CONFIGURED") {
    if (error.reason === "Paste a post with at least 8 characters.") return error.reason;
    return "AI draft is not configured.";
  }
  const reason = error.reason || "AI draft failed.";
  if (/sk-|api[_-]?key|bearer\s+[a-z0-9._-]+/i.test(reason)) return "AI draft failed.";
  return reason.slice(0, 180);
}
