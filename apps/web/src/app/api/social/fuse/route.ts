import { NextResponse } from "next/server";
import { loadEnv, loadRepoEnv, socialAvailability } from "@fused-ai/config";
import { createDatabaseClient } from "@fused-ai/database";
import { createSocialProvider, parseXPostUrl } from "@fused-ai/social";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  loadRepoEnv();
  const env = loadEnv();
  let body: { url?: string } = {};
  try {
    body = (await request.json()) as { url?: string };
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const ref = typeof body.url === "string" ? parseXPostUrl(body.url) : null;
  if (!ref) return NextResponse.json({ ok: false, error: "Enter a valid X post URL." }, { status: 400 });
  if (socialAvailability(env).status !== "OK") {
    return NextResponse.json({ ok: false, error: "This post is not available right now." }, { status: 503 });
  }
  const fetched = await createSocialProvider(env).getPost(ref.postId);
  if (!fetched.ok) {
    return NextResponse.json({ ok: false, error: "This post is not available right now." }, { status: 503 });
  }
  const db = createDatabaseClient(env);
  if (env.databaseUrl) {
    await db.upsertSocialPost(fetched.value);
  }
  await db.close();
  return NextResponse.json({ ok: true, postId: fetched.value.postId });
}
