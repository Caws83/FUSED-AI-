import { NextResponse } from "next/server";
import { loadEnv, loadRepoEnv } from "@fused-ai/config";
import { applySignedFusedProfile, readFusedProfile } from "../../../../lib/profile-update.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  loadRepoEnv();
  const env = loadEnv();
  const url = new URL(request.url);
  const result = await readFusedProfile(url.searchParams.get("address") ?? "", env);
  return NextResponse.json(result.body, { status: result.status });
}

export async function PUT(request: Request) {
  loadRepoEnv();
  const env = loadEnv();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  const result = await applySignedFusedProfile(body, env);
  return NextResponse.json(result.body, { status: result.status });
}
