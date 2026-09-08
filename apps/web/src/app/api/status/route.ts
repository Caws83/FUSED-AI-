import { NextResponse } from "next/server";
import { loadEnv, systemStatus } from "@fused-ai/config";
import { listDexAdapters } from "@fused-ai/blockchain";

export const dynamic = "force-dynamic";

export function GET() {
  const env = loadEnv();
  return NextResponse.json({
    status: systemStatus(env),
    dex: listDexAdapters(env).map((a) => a.info()),
  });
}
