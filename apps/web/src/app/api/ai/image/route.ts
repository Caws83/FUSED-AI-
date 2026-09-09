import { NextResponse } from "next/server";
import { loadEnv, loadRepoEnv } from "@fused-ai/config";
import { createAIImageProvider, createMediaStore, validateImage } from "@fused-ai/media";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  loadRepoEnv();
  const env = loadEnv();
  let body: { name?: string; symbol?: string; description?: string; imagePrompt?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  if (!body.name || !body.symbol) {
    return NextResponse.json({ ok: false, error: "Name and ticker are required." }, { status: 400 });
  }

  const provider = createAIImageProvider(env);
  const generated = await provider.generateTokenImage({
    name: body.name,
    symbol: body.symbol,
    description: body.description,
    imagePrompt: body.imagePrompt,
  });
  if (!generated.ok) {
    return NextResponse.json({ ok: false, error: "AI artwork is temporarily unavailable." }, { status: 503 });
  }
  const checked = validateImage(generated.value.bytes, generated.value.mime);
  if (!checked.ok) {
    return NextResponse.json({ ok: false, error: checked.reason }, { status: 400 });
  }
  const store = createMediaStore(env);
  const saved = await store.uploadTokenImage(checked.value);
  if (!saved.ok) {
    return NextResponse.json({ ok: false, error: "Upload is temporarily unavailable." }, { status: 503 });
  }
  return NextResponse.json({
    ok: true,
    id: saved.value.id,
    url: store.getPublicUrl(saved.value.id),
  });
}
