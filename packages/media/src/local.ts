import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { AVAILABILITY_STATUS, notConfigured } from "@fused-ai/types";
import { err, ok, type Result } from "@fused-ai/shared";
import type { MediaStore, StoredImage } from "./store.ts";
import type { ValidatedImage } from "./validate.ts";

const ID = /^[a-f0-9]{32,64}$/;

export class LocalMediaStore implements MediaStore {
  readonly id = "local";
  private readonly root: string;
  private readonly publicBase: string;
  constructor(root: string, publicBase: string) {
    this.root = root;
    this.publicBase = publicBase;
  }

  availability() {
    if (!this.root) return notConfigured(["MEDIA_LOCAL_PATH"]);
    return { status: AVAILABILITY_STATUS.OK };
  }

  async uploadTokenImage(image: ValidatedImage): Promise<Result<StoredImage>> {
    const a = this.availability();
    if (a.status !== "OK") return err(a);
    const digest = createHash("sha256").update(image.bytes).digest("hex");
    const id = `${digest.slice(0, 24)}${randomBytes(4).toString("hex")}`;
    await mkdir(this.root, { recursive: true });
    const file = path.join(/*turbopackIgnore: true*/ this.root, `${id}.${image.extension}`);
    await writeFile(file, image.bytes);
    return ok({ id: `${id}.${image.extension}`, mime: image.mime, bytes: image.bytes.byteLength });
  }

  getPublicUrl(id: string): string | null {
    if (!safeId(id)) return null;
    const base = this.publicBase.replace(/\/$/, "");
    return `${base}/${id}`;
  }

  async read(id: string): Promise<Result<{ bytes: Uint8Array; mime: string }>> {
    if (!safeId(id)) return err({ status: "NOT_CONFIGURED", reason: "Invalid media id." });
    try {
      const bytes = await readFile(path.join(this.root, id));
      const mime = id.endsWith(".png") ? "image/png" : id.endsWith(".webp") ? "image/webp" : "image/jpeg";
      return ok({ bytes, mime });
    } catch {
      return err({ status: "NOT_CONFIGURED", reason: "Media not found." });
    }
  }

  async deleteTemporaryImage(id: string): Promise<Result<true>> {
    if (!safeId(id)) return err({ status: "NOT_CONFIGURED", reason: "Invalid media id." });
    try {
      await unlink(path.join(this.root, id));
      return ok(true);
    } catch {
      return err({ status: "NOT_CONFIGURED", reason: "Media not found." });
    }
  }
}

function safeId(id: string): boolean {
  const [stem, ext] = id.split(".");
  return Boolean(stem && ID.test(stem) && (ext === "png" || ext === "jpg" || ext === "webp"));
}
