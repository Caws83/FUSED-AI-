import type { Availability } from "@fused-ai/types";
import type { Result } from "@fused-ai/shared";
import type { ValidatedImage } from "./validate.ts";

export type StoredImage = {
  id: string;
  mime: ValidatedImage["mime"];
  bytes: number;
};

export type MediaStore = {
  readonly id: string;
  availability(): Availability;
  uploadTokenImage(image: ValidatedImage): Promise<Result<StoredImage>>;
  getPublicUrl(id: string): string | null;
  read(id: string): Promise<Result<{ bytes: Uint8Array; mime: string }>>;
  deleteTemporaryImage(id: string): Promise<Result<true>>;
};
