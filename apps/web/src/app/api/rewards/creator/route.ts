import { NextResponse } from "next/server";
import { loadEnv, loadRepoEnv, launchContractsForChain, parseSupportedChainId } from "@fused-ai/config";
import { createDatabaseClient } from "@fused-ai/database";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export async function GET(request: Request) {
  try {
    loadRepoEnv();
    const env = loadEnv();
    const url = new URL(request.url);
    const address = url.searchParams.get("address")?.trim() ?? "";
    const chainId = parseSupportedChainId(url.searchParams.get("chainId"));
    if (!ADDRESS_RE.test(address) || chainId == null) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    const mapped = launchContractsForChain(chainId);
    const factory = mapped?.deployed ? mapped.factory : null;
    if (!factory) {
      return NextResponse.json({ ok: false, reason: "factory" }, { status: 404 });
    }
    if (!env.databaseUrl) {
      return NextResponse.json({
        ok: true,
        factory,
        chainId,
        launches: [],
      });
    }
    const db = createDatabaseClient(env);
    try {
      const rows = await db.listLaunchesByLauncher(chainId, address as `0x${string}`, factory as `0x${string}`);
      const launches = rows.ok
        ? rows.value.map((row) => ({
            token: row.token,
            name: row.name,
            symbol: row.symbol,
            chainId: row.chainId,
            factory: row.factory,
          }))
        : [];
      return NextResponse.json({ ok: true, factory, chainId, launches });
    } finally {
      await db.close();
    }
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
