import { NextResponse } from "next/server";
import { loadEnv, loadRepoEnv } from "@fused-ai/config";
import { aiImageRouteError, createMediaStore, generateAndStoreTokenLogo } from "@fused-ai/media";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  loadRepoEnv();
  const env = loadEnv();
  let body: { name?: string; symbol?: string; description?: string; imagePrompt?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  if (!body.name?.trim() || !body.symbol?.trim()) {
    return NextResponse.json({ ok: false, error: "Name and ticker are required." }, { status: 400 });
  }

  const result = await generateAndStoreTokenLogo(
    env,
    {
      name: body.name,
      symbol: body.symbol,
      description: body.description,
      imagePrompt: body.imagePrompt,
    },
    { store: createMediaStore(env) },
  );
  if (!result.ok) {
    const status = result.error.reason === "Name and ticker are required." ? 400 : 503;
    return NextResponse.json({ ok: false, error: aiImageRouteError(result.error) }, { status });
  }
  return NextResponse.json({
    ok: true,
    id: result.value.id,
    url: result.value.url,
  });
}
