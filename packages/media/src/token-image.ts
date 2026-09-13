import { assertPublicMediaUrl } from "./urls.ts";

export const FUSED_TOKEN_IMAGE_FALLBACK = "/brand/fused-token.svg";

export type LaunchImageInput = {
  imageId?: string | null;
  imageUrl?: string | null;
};

function trimOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** Read the launch-sync / form fields. Logo aliases are ignored on purpose. */
export function readLaunchSyncImage(extra: Record<string, unknown> | null | undefined): LaunchImageInput {
  const body = extra ?? {};
  return {
    imageId: trimOrNull(body.imageId),
    imageUrl: trimOrNull(body.imageUrl),
  };
}

/**
 * Persist only a validated public media URL.
 * Prefer an already-public imageUrl (AI or manual R2), then reconstruct from imageId.
 */
export function resolvePersistedLaunchImage(
  input: LaunchImageInput,
  options: {
    chainId: number | null;
    publicUrlForId?: (id: string) => string | null;
  },
): { imageId: string | null; imageUrl: string | null } {
  const imageId = trimOrNull(input.imageId);
  const candidates = [trimOrNull(input.imageUrl), imageId && options.publicUrlForId ? options.publicUrlForId(imageId) : null];
  for (const url of candidates) {
    if (url && assertPublicMediaUrl(url, options.chainId).ok) {
      return { imageId, imageUrl: url };
    }
  }
  return { imageId, imageUrl: null };
}

/** Token pages and cards: persisted valid URL, otherwise the FUSED mark. */
export function tokenImageSrc(imageUrl: string | null | undefined, chainId: number | null): string {
  if (imageUrl && assertPublicMediaUrl(imageUrl, chainId).ok) return imageUrl;
  return FUSED_TOKEN_IMAGE_FALLBACK;
}
