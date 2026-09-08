const MAX_BYTES = 2 * 1024 * 1024;

export type ImageKind = "png" | "jpeg" | "webp";

export type ValidatedImage = {
  kind: ImageKind;
  mime: "image/png" | "image/jpeg" | "image/webp";
  bytes: Uint8Array;
  extension: "png" | "jpg" | "webp";
};

function sniff(bytes: Uint8Array): ImageKind | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  const riff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
  const webp = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if (riff && webp) return "webp";
  return null;
}

export function validateImage(bytes: Uint8Array, declaredMime?: string): { ok: true; value: ValidatedImage } | { ok: false; reason: string } {
  if (bytes.byteLength === 0) return { ok: false, reason: "Empty file." };
  if (bytes.byteLength > MAX_BYTES) return { ok: false, reason: "Image is larger than 2 MB." };
  const kind = sniff(bytes);
  if (!kind) return { ok: false, reason: "Only PNG, JPEG, and WEBP images are allowed." };
  if (declaredMime) {
    const allowed =
      (kind === "png" && declaredMime === "image/png") ||
      (kind === "jpeg" && (declaredMime === "image/jpeg" || declaredMime === "image/jpg")) ||
      (kind === "webp" && declaredMime === "image/webp");
    if (!allowed) return { ok: false, reason: "File type does not match its contents." };
  }
  return {
    ok: true,
    value: {
      kind,
      mime: kind === "jpeg" ? "image/jpeg" : kind === "png" ? "image/png" : "image/webp",
      bytes,
      extension: kind === "jpeg" ? "jpg" : kind,
    },
  };
}

export const MAX_IMAGE_BYTES = MAX_BYTES;
