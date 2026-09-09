import path from "node:path";
import type { FusedEnv } from "@fused-ai/config";
import { findRepoRoot } from "@fused-ai/config";
import { LocalMediaStore } from "./local.ts";
import { ObjectMediaStore } from "./object-store.ts";
import type { MediaStore } from "./store.ts";

export type { MediaStore, StoredImage } from "./store.ts";
export { validateImage, MAX_IMAGE_BYTES, type ImageKind, type ValidatedImage } from "./validate.ts";
export { assertPublicMediaUrl, isLocalChain } from "./urls.ts";
export { createAIImageProvider, UnavailableAIImageProvider, type AIImageInput, type AIImageProvider } from "./ai-image.ts";

export function createMediaStore(env: FusedEnv): MediaStore {
  const kind = (env.media.store || "").toLowerCase();
  if (kind === "s3" || kind === "r2") return new ObjectMediaStore();
  if (env.production || kind !== "local") return new ObjectMediaStore();
  const root = env.media.localPath || path.join(findRepoRoot(), ".local-data", "media");
  const publicBase = env.media.publicBase || "/api/media";
  return new LocalMediaStore(root, publicBase);
}
