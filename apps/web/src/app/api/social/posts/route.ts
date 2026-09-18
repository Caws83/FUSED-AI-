import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAddress } from "viem";
import { loadEnv, loadRepoEnv } from "@fused-ai/config";
import { createDatabaseClient } from "@fused-ai/database";
import { fusedFeedSocialPost, parseFusedFeedCreate } from "@fused-ai/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  loadRepoEnv();
  const env = loadEnv();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const parsed = parseFusedFeedCreate(body);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });

  let address: string;
  try {
    address = getAddress(parsed.address);
  } catch {
    return NextResponse.json({ ok: false, error: "Connect a wallet to post." }, { status: 400 });
  }

  const post = fusedFeedSocialPost({
    postId: randomUUID(),
    address,
    text: parsed.text,
  });
  if (!post) return NextResponse.json({ ok: false, error: "Invalid post." }, { status: 400 });

  const db = createDatabaseClient(env);
  const saved = await db.upsertSocialPost(post);
  await db.close();
  if (!saved.ok) {
    return NextResponse.json({ ok: false, error: "Feed is temporarily unavailable." }, { status: 503 });
  }
  return NextResponse.json({ ok: true, post });
}
