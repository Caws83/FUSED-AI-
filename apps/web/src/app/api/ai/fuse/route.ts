import { NextResponse } from "next/server";
import { loadEnv, loadRepoEnv } from "@fused-ai/config";
import { runFusePost } from "../../../../lib/fuse-post.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(request: Request) {
  loadRepoEnv();
  const env = loadEnv();
  let body: { text?: unknown } = {};
  try {
    body = (await request.json()) as { text?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  if (typeof body.text !== "string") {
    return NextResponse.json({ ok: false, error: "Paste post text to fuse." }, { status: 400 });
  }

  const result = await runFusePost(env, body.text);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    ok: true,
    draft: result.draft,
    image: result.image,
    imageError: result.imageError,
  });
}
