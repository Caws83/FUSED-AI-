import { notConfigured } from "@fused-ai/types";
import { fail, type Result } from "@fused-ai/shared";
import type { MediaStore, StoredImage } from "./store.ts";
import type { ValidatedImage } from "./validate.ts";

/** S3 / R2 adapter. Inactive until real credentials exist. */
export class ObjectMediaStore implements MediaStore {
  readonly id = "s3";
  availability() {
    return notConfigured(
      ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "BUCKET_NAME", "IMAGE_PUBLIC_BASE"],
      "Object storage is not configured.",
    );
  }
  async uploadTokenImage(_image: ValidatedImage): Promise<Result<StoredImage>> {
    return fail(this.availability());
  }
  getPublicUrl(): string | null {
    return null;
  }
  async read(): Promise<Result<{ bytes: Uint8Array; mime: string }>> {
    return fail(this.availability());
  }
  async deleteTemporaryImage(): Promise<Result<true>> {
    return fail(this.availability());
  }
}
