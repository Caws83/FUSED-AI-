import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { databaseUnavailable, type Availability } from "@fused-ai/types";
import { err, fail, ok, type Result } from "@fused-ai/shared";
import { databaseAvailability, type FusedEnv } from "@fused-ai/config";
import type { HexAddress, IndexedLaunch } from "@fused-ai/types";

export type LaunchInsert = {
  chainId: number;
  token: HexAddress;
  name: string;
  symbol: string;
  launcher: HexAddress;
  quote: HexAddress;
  poolId: `0x${string}` | null;
  tokenId: string;
  startTick: number;
  lpFee: number;
  supply: string;
  metadataURI: string;
  txHash: `0x${string}`;
  blockNumber: bigint;
  createdAt: Date | null;
  factory: HexAddress | null;
  locker: HexAddress | null;
  dexVersion?: string;
};

export type DatabaseClient = {
  availability(): Availability;
  ping(): Promise<Result<true>>;
  migrate(): Promise<Result<true>>;
  upsertLaunch(row: LaunchInsert): Promise<Result<true>>;
  listLaunches(chainId: number): Promise<Result<IndexedLaunch[]>>;
  getLaunch(chainId: number, token: string): Promise<Result<IndexedLaunch | null>>;
  getCursor(chainId: number): Promise<Result<bigint | null>>;
  setCursor(chainId: number, blockNumber: bigint): Promise<Result<true>>;
  close(): Promise<void>;
};

function schemaPath(): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "schema.sql");
}

function mapLaunch(row: Record<string, unknown>): IndexedLaunch {
  const token = String(row.token) as HexAddress;
  return {
    chainId: Number(row.chain_id),
    token,
    name: String(row.name ?? ""),
    symbol: String(row.symbol ?? ""),
    launcher: String(row.launcher) as HexAddress,
    quote: String(row.quote) as HexAddress,
    poolId: row.pool_id ? (String(row.pool_id) as `0x${string}`) : null,
    tokenId: row.token_id == null ? "0" : String(row.token_id),
    startTick: row.start_tick == null ? null : Number(row.start_tick),
    lpFee: row.lp_fee == null ? null : Number(row.lp_fee),
    supply: row.supply == null ? null : String(row.supply),
    metadataURI: String(row.metadata_uri ?? ""),
    txHash: String(row.tx_hash) as `0x${string}`,
    blockNumber: BigInt(String(row.block_number)),
    createdAt: row.block_time ? new Date(String(row.block_time)).toISOString() : null,
    factory: row.factory ? (String(row.factory) as HexAddress) : null,
    locker: row.locker ? (String(row.locker) as HexAddress) : null,
    dexVersion: String(row.dex_version ?? "v4"),
  };
}

export function createDatabaseClient(env: FusedEnv): DatabaseClient {
  const availability = () => databaseAvailability(env);
  let sql: ReturnType<typeof postgres> | null = null;

  const conn = () => {
    if (!env.databaseUrl) return null;
    if (!sql) sql = postgres(env.databaseUrl, { max: 4, idle_timeout: 20 });
    return sql;
  };

  return {
    availability,
    ping: async () => {
      const a = availability();
      if (a.status !== "OK") return fail(a);
      try {
        const client = conn();
        if (!client) return fail(a);
        await client`select 1`;
        return ok(true);
      } catch (error) {
        return err(databaseUnavailable(error instanceof Error ? error.message : "Postgres ping failed"));
      }
    },
    migrate: async () => {
      const a = availability();
      if (a.status !== "OK") return fail(a);
      const client = conn();
      if (!client) return fail(a);
      try {
        const schema = readFileSync(schemaPath(), "utf8");
        await client.unsafe(schema);
        await client.unsafe(`
          ALTER TABLE fused_launches ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT '';
          ALTER TABLE fused_launches ADD COLUMN IF NOT EXISTS symbol text NOT NULL DEFAULT '';
          ALTER TABLE fused_launches ADD COLUMN IF NOT EXISTS token_id numeric(78,0);
          ALTER TABLE fused_launches ADD COLUMN IF NOT EXISTS start_tick integer;
          ALTER TABLE fused_launches ADD COLUMN IF NOT EXISTS lp_fee integer;
          ALTER TABLE fused_launches ADD COLUMN IF NOT EXISTS supply numeric(78,0);
          ALTER TABLE fused_launches ADD COLUMN IF NOT EXISTS metadata_uri text NOT NULL DEFAULT '';
          ALTER TABLE fused_launches ADD COLUMN IF NOT EXISTS block_time timestamptz;
          ALTER TABLE fused_launches ADD COLUMN IF NOT EXISTS factory text;
          ALTER TABLE fused_launches ADD COLUMN IF NOT EXISTS locker text;
          ALTER TABLE fused_launches ADD COLUMN IF NOT EXISTS dex_version text NOT NULL DEFAULT 'v4';
        `);
        return ok(true);
      } catch (error) {
        return err(databaseUnavailable(error instanceof Error ? error.message : "migrate failed"));
      }
    },
    upsertLaunch: async (row) => {
      const a = availability();
      if (a.status !== "OK") return fail(a);
      const client = conn();
      if (!client) return fail(a);
      try {
        await client`
          INSERT INTO fused_launches (
            chain_id, token, name, symbol, launcher, quote, pool_id, token_id,
            start_tick, lp_fee, supply, metadata_uri, tx_hash, block_number,
            block_time, factory, locker, dex_version
          ) VALUES (
            ${row.chainId}, ${row.token.toLowerCase()}, ${row.name}, ${row.symbol},
            ${row.launcher.toLowerCase()}, ${row.quote.toLowerCase()}, ${row.poolId},
            ${row.tokenId}, ${row.startTick}, ${row.lpFee}, ${row.supply}, ${row.metadataURI},
            ${row.txHash}, ${row.blockNumber.toString()}, ${row.createdAt},
            ${row.factory?.toLowerCase() ?? null}, ${row.locker?.toLowerCase() ?? null},
            ${row.dexVersion ?? "v4"}
          )
          ON CONFLICT (chain_id, token) DO UPDATE SET
            name = EXCLUDED.name,
            symbol = EXCLUDED.symbol,
            launcher = EXCLUDED.launcher,
            quote = EXCLUDED.quote,
            pool_id = EXCLUDED.pool_id,
            token_id = EXCLUDED.token_id,
            start_tick = EXCLUDED.start_tick,
            lp_fee = EXCLUDED.lp_fee,
            supply = EXCLUDED.supply,
            metadata_uri = EXCLUDED.metadata_uri,
            tx_hash = EXCLUDED.tx_hash,
            block_number = EXCLUDED.block_number,
            block_time = EXCLUDED.block_time,
            factory = EXCLUDED.factory,
            locker = EXCLUDED.locker,
            dex_version = EXCLUDED.dex_version
        `;
        return ok(true);
      } catch (error) {
        return err(databaseUnavailable(error instanceof Error ? error.message : "upsert failed"));
      }
    },
    listLaunches: async (chainId) => {
      const a = availability();
      if (a.status !== "OK") return fail(a);
      const client = conn();
      if (!client) return fail(a);
      try {
        const rows = await client`
          SELECT * FROM fused_launches WHERE chain_id = ${chainId} ORDER BY block_number DESC
        `;
        return ok(rows.map((row) => mapLaunch(row as Record<string, unknown>)));
      } catch (error) {
        return err(databaseUnavailable(error instanceof Error ? error.message : "list failed"));
      }
    },
    getLaunch: async (chainId, token) => {
      const a = availability();
      if (a.status !== "OK") return fail(a);
      const client = conn();
      if (!client) return fail(a);
      try {
        const rows = await client`
          SELECT * FROM fused_launches
          WHERE chain_id = ${chainId} AND token = ${token.toLowerCase()}
          LIMIT 1
        `;
        const row = rows[0];
        return ok(row ? mapLaunch(row as Record<string, unknown>) : null);
      } catch (error) {
        return err(databaseUnavailable(error instanceof Error ? error.message : "get failed"));
      }
    },
    getCursor: async (chainId) => {
      const a = availability();
      if (a.status !== "OK") return fail(a);
      const client = conn();
      if (!client) return fail(a);
      try {
        const rows = await client`SELECT block_number FROM fused_sync_cursor WHERE chain_id = ${chainId}`;
        const value = rows[0]?.block_number;
        return ok(value == null ? null : BigInt(String(value)));
      } catch (error) {
        return err(databaseUnavailable(error instanceof Error ? error.message : "cursor read failed"));
      }
    },
    setCursor: async (chainId, blockNumber) => {
      const a = availability();
      if (a.status !== "OK") return fail(a);
      const client = conn();
      if (!client) return fail(a);
      try {
        await client`
          INSERT INTO fused_sync_cursor (chain_id, block_number, updated_at)
          VALUES (${chainId}, ${blockNumber.toString()}, now())
          ON CONFLICT (chain_id) DO UPDATE SET block_number = EXCLUDED.block_number, updated_at = now()
        `;
        return ok(true);
      } catch (error) {
        return err(databaseUnavailable(error instanceof Error ? error.message : "cursor write failed"));
      }
    },
    close: async () => {
      if (sql) {
        await sql.end({ timeout: 2 });
        sql = null;
      }
    },
  };
}
