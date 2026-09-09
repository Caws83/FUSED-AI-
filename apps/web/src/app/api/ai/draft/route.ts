import { NextResponse } from "next/server";
import { loadEnv, loadRepoEnv } from "@fused-ai/config";
import { createAIProvider } from "@fused-ai/ai";
import { createDatabaseClient } from "@fused-ai/database";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  loadRepoEnv();
  const env = loadEnv();
  let body: { postId?: string } = {};
  try {
    body = (await request.json()) as { postId?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  if (!body.postId) return NextResponse.json({ ok: false, error: "A post is required." }, { status: 400 });

  const db = createDatabaseClient(env);
  const post = await db.getSocialPost("x", body.postId);
  await db.close();
  if (!post.ok || !post.value) {
    return NextResponse.json({ ok: false, error: "This post is not available right now." }, { status: 404 });
  }

  const ai = createAIProvider(env);
  const result = await ai.generateLaunchFromPost(post.value);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "AI draft is temporarily unavailable." }, { status: 503 });
  }
  return NextResponse.json({
    ok: true,
    draft: result.value.draft,
    issues: result.value.issues,
  });
}
