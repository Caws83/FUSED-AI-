import { NextResponse } from "next/server";
import { loadEnv, systemStatus } from "@fused-ai/config";
import { listDexAdapters } from "@fused-ai/blockchain";

export const dynamic = "force-dynamic";

export function GET() {
  const env = loadEnv();
  const status = systemStatus(env);
  return NextResponse.json({
    status,
    dex: listDexAdapters(env).map((a) => a.info()),
  });
}
