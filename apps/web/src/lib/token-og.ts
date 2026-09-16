import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { FUSED_TOKEN_IMAGE_FALLBACK, tokenImageSrc } from "@fused-ai/media/token-image";

/** Facebook, X, Discord, and LinkedIn share cards. */
export const TOKEN_OG_SIZE = {
  width: 1200,
  height: 630,
} as const;

/** Square token art, centered in the 1.91:1 frame with safe padding. */
export const TOKEN_OG_ART = 540;

export function absoluteMediaUrl(src: string, appUrl: string): string {
  if (/^https?:\/\//i.test(src)) return src;
  const base = appUrl.replace(/\/$/, "");
  const pathName = src.startsWith("/") ? src : `/${src}`;
  return `${base}${pathName}`;
}

function publicFileCandidates(rel: string): string[] {
  const cleaned = rel.replace(/^\//, "").replace(/\\/g, "/");
  return [
    path.join(process.cwd(), "public", cleaned),
    path.join(process.cwd(), "apps", "web", "public", cleaned),
  ];
}

export function resolvePublicAssetPath(rel: string): string | null {
  for (const candidate of publicFileCandidates(rel)) {
    if (existsSync(/* turbopackIgnore: true */ candidate)) return candidate;
  }
  return null;
}

export async function readPublicAsset(rel: string): Promise<Buffer | null> {
  const file = resolvePublicAssetPath(rel);
  if (!file) return null;
  return readFile(/* turbopackIgnore: true */ file);
}

export function tokenOgImageSrc(
  imageUrl: string | null | undefined,
  chainId: number | null,
): string {
  return tokenImageSrc(imageUrl, chainId);
}

export function sniffOgImageMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return "image/gif";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46
  ) {
    return "image/webp";
  }
  return null;
}

export function rasterDataUri(bytes: Uint8Array): string | null {
  const mime = sniffOgImageMime(bytes);
  if (!mime) return null;
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}

export async function resolveTokenOgImgSrc(
  imageUrl: string | null | undefined,
  chainId: number | null,
  appUrl: string,
): Promise<string | null> {
  const src = tokenOgImageSrc(imageUrl, chainId);
  if (/^https?:\/\//i.test(src)) {
    try {
      const res = await fetch(src, { cache: "no-store" });
      if (!res.ok) return src;
      const uri = rasterDataUri(new Uint8Array(await res.arrayBuffer()));
      return uri ?? src;
    } catch {
      return src;
    }
  }
  if (src.startsWith("/")) {
    const local = await readPublicAsset(src);
    if (local) {
      const uri = rasterDataUri(new Uint8Array(local));
      if (uri) return uri;
    }
    if (appUrl && src !== FUSED_TOKEN_IMAGE_FALLBACK) {
      return absoluteMediaUrl(src, appUrl);
    }
  }
  return null;
}
