import { NextResponse } from "next/server";
import { loadEnv, loadRepoEnv } from "@fused-ai/config";
import { createMediaStore } from "@fused-ai/media";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  loadRepoEnv();
  const env = loadEnv();
  const { id } = await params;
  const store = createMediaStore(env);
  const file = await store.read(id);
  if (!file.ok) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(Buffer.from(file.value.bytes), {
    headers: {
      "content-type": file.value.mime,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
