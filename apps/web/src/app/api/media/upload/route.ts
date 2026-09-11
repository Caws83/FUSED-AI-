import { NextResponse } from "next/server";
import { loadEnv, loadRepoEnv } from "@fused-ai/config";
import { createMediaStore, validateImage } from "@fused-ai/media";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  loadRepoEnv();
  const env = loadEnv();
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "Choose an image." }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const checked = validateImage(bytes, file.type);
  if (!checked.ok) return NextResponse.json({ ok: false, error: checked.reason }, { status: 400 });
  const store = createMediaStore(env);
  const saved = await store.uploadTokenImage(checked.value);
  if (!saved.ok) return NextResponse.json({ ok: false, error: "Upload is temporarily unavailable." }, { status: 503 });
  return NextResponse.json({
    ok: true,
    id: saved.value.id,
    url: store.getPublicUrl(saved.value.id),
  });
}
