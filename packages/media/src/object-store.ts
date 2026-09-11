import { createHash, randomBytes } from "node:crypto";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { providerUnavailable } from "@fused-ai/types";
import { err, fail, ok, type Result } from "@fused-ai/shared";
import type { FusedEnv } from "@fused-ai/config";
import { mediaAvailability } from "@fused-ai/config";
import type { MediaStore, StoredImage } from "./store.ts";
import type { ValidatedImage } from "./validate.ts";

const ID = /^[a-f0-9]{32,64}$/;

function safeId(id: string): boolean {
  const [stem, ext] = id.split(".");
  return Boolean(stem && ID.test(stem) && (ext === "png" || ext === "jpg" || ext === "webp"));
}

export function objectPublicUrl(publicBase: string | null | undefined, id: string): string | null {
  if (!safeId(id)) return null;
  const base = (publicBase || "").replace(/\/$/, "");
  if (!base) return null;
  return `${base}/${id}`;
}

/** S3 / R2 adapter. Uses AWS_* + BUCKET_NAME + IMAGE_PUBLIC_BASE. */
export class ObjectMediaStore implements MediaStore {
  readonly id = "s3";
  private readonly env: FusedEnv;
  private client: S3Client | null = null;

  constructor(env: FusedEnv) {
    this.env = env;
  }

  availability() {
    return mediaAvailability(this.env);
  }

  getPublicUrl(id: string): string | null {
    return objectPublicUrl(this.env.media.publicBase, id);
  }

  async uploadTokenImage(image: ValidatedImage): Promise<Result<StoredImage>> {
    const a = this.availability();
    if (a.status !== "OK") return fail(a);
    const digest = createHash("sha256").update(image.bytes).digest("hex");
    const id = `${digest.slice(0, 24)}${randomBytes(4).toString("hex")}.${image.extension}`;
    try {
      await this.s3().send(
        new PutObjectCommand({
          Bucket: this.env.media.bucket ?? undefined,
          Key: id,
          Body: image.bytes,
          ContentType: image.mime,
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
      return ok({ id, mime: image.mime, bytes: image.bytes.byteLength });
    } catch (error) {
      return err(providerUnavailable(error instanceof Error ? error.message.slice(0, 180) : "Object upload failed."));
    }
  }

  async read(id: string): Promise<Result<{ bytes: Uint8Array; mime: string }>> {
    if (!safeId(id)) return err({ status: "NOT_CONFIGURED", reason: "Invalid media id." });
    return err({
      status: "NOT_CONFIGURED",
      reason: "Object storage is served from IMAGE_PUBLIC_BASE, not the local media route.",
    });
  }

  async deleteTemporaryImage(id: string): Promise<Result<true>> {
    if (!safeId(id)) return err({ status: "NOT_CONFIGURED", reason: "Invalid media id." });
    const a = this.availability();
    if (a.status !== "OK") return fail(a);
    try {
      await this.s3().send(new DeleteObjectCommand({ Bucket: this.env.media.bucket ?? undefined, Key: id }));
      return ok(true);
    } catch {
      return err({ status: "NOT_CONFIGURED", reason: "Media not found." });
    }
  }

  private s3(): S3Client {
    if (this.client) return this.client;
    this.client = new S3Client({
      region: this.env.media.awsRegion || "auto",
      endpoint: this.env.media.awsEndpoint || undefined,
      forcePathStyle: Boolean(this.env.media.awsEndpoint),
      credentials: {
        accessKeyId: this.env.media.awsAccessKeyId || "",
        secretAccessKey: this.env.media.awsSecretAccessKey || "",
      },
    });
    return this.client;
  }
}
