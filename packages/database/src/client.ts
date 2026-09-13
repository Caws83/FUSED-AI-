import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { databaseUnavailable, type Availability } from "@fused-ai/types";
import { err, fail, ok, type Result } from "@fused-ai/shared";
import { databaseAvailability, type FusedEnv } from "@fused-ai/config";
import { postgresClientOptions } from "./postgres-options.ts";
import type { HexAddress, IndexedLaunch, SocialPost, TrackedAccount } from "@fused-ai/types";

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
  lifecycleState?: string;
  graduationTarget?: string;
};

export type TokenMetadataInput = {
  chainId: number;
  token: HexAddress;
  description?: string;
  imageId?: string | null;
  imageUrl?: string | null;
  sourcePlatform?: string | null;
  sourcePostId?: string | null;
  sourceAuthor?: string | null;
  sourcePostUrl?: string | null;
  sourceExcerpt?: string | null;
};

export type DatabaseClient = {
  availability(): Availability;
  ping(): Promise<Result<true>>;
  migrate(): Promise<Result<true>>;
  upsertLaunch(row: LaunchInsert): Promise<Result<true>>;
  listLaunches(chainId: number): Promise<Result<IndexedLaunch[]>>;
  getLaunch(chainId: number, token: string): Promise<Result<IndexedLaunch | null>>;
  upsertTokenMetadata(row: TokenMetadataInput): Promise<Result<true>>;
  upsertSocialPost(post: SocialPost): Promise<Result<true>>;
  getSocialPost(platform: string, postId: string): Promise<Result<SocialPost | null>>;
  upsertTrackedAccount(account: TrackedAccount): Promise<Result<true>>;
  markSocialSync(id: string, postCount: number): Promise<Result<true>>;
  lastSocialSync(): Promise<Result<{ lastSyncAt: string | null; postCount: number }>>;
  getCursor(chainId: number): Promise<Result<bigint | null>>;
  setCursor(chainId: number, blockNumber: bigint): Promise<Result<true>>;
  updateMarket(row: {
    chainId: number;
    token: HexAddress;
    lifecycleState: string;
    realQuote: string;
    graduationTarget: string;
    circulating: string;
    priceX18: string;
    tokenId?: string | null;
    poolId?: string | null;
    dexVersion: string;
  }): Promise<Result<true>>;
  insertTrade(row: {
    chainId: number;
    token: HexAddress;
    txHash: `0x${string}`;
    logIndex: number;
    blockNumber: bigint;
    tradedAt: Date;
    trader: HexAddress;
    isBuy: boolean;
    tokenAmount: string;
    quoteAmount: string;
    priceX18: string;
    venue: string;
  }): Promise<Result<true>>;
  applyTransfer(row: {
    chainId: number;
    token: HexAddress;
    from: HexAddress;
    to: HexAddress;
    value: string;
    txHash?: `0x${string}`;
    logIndex?: number;
  }): Promise<Result<true>>;
  listTrades(chainId: number, token: string, limit?: number): Promise<Result<Record<string, unknown>[]>>;
  listCandles(chainId: number, token: string, intervalSec: number, limit?: number): Promise<Result<Record<string, unknown>[]>>;
  tokenStats(chainId: number, token: string): Promise<Result<{ volumeTotal: string; volume24h: string; tradeCount: number; holderCount: number }>>;
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
    dexVersion: String(row.dex_version ?? "curve"),
    imageId: row.image_id ? String(row.image_id) : null,
    imageUrl: row.image_url ? String(row.image_url) : null,
    appDescription: row.app_description != null ? String(row.app_description) : null,
    sourcePlatform: row.source_platform ? String(row.source_platform) : null,
    sourcePostId: row.source_post_id ? String(row.source_post_id) : null,
    sourcePostUrl: row.source_post_url ? String(row.source_post_url) : null,
    sourceAuthor: row.source_author ? String(row.source_author) : null,
    sourceExcerpt: row.source_excerpt ? String(row.source_excerpt) : null,
    lifecycleState: String(row.lifecycle_state ?? "CURVE"),
    realQuote: row.real_quote == null ? null : String(row.real_quote),
    graduationTarget: row.graduation_target == null ? null : String(row.graduation_target),
    circulating: row.circulating == null ? null : String(row.circulating),
    priceX18: row.price_x18 == null ? null : String(row.price_x18),
    volumeQuote: row.volume_quote == null ? null : String(row.volume_quote),
    holderCount: row.holder_count == null ? null : Number(row.holder_count),
  };
}

export function createDatabaseClient(env: FusedEnv): DatabaseClient {
  const availability = () => databaseAvailability(env);
  let sql: ReturnType<typeof postgres> | null = null;

  const conn = () => {
    if (!env.databaseUrl) return null;
    if (!sql) sql = postgres(env.databaseUrl, postgresClientOptions(env.databaseUrl));
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
          ALTER TABLE fused_launches ADD COLUMN IF NOT EXISTS dex_version text NOT NULL DEFAULT 'curve';
          ALTER TABLE fused_launches ADD COLUMN IF NOT EXISTS lifecycle_state text NOT NULL DEFAULT 'CURVE';
          ALTER TABLE fused_launches ADD COLUMN IF NOT EXISTS real_quote numeric(78,0);
          ALTER TABLE fused_launches ADD COLUMN IF NOT EXISTS graduation_target numeric(78,0);
          ALTER TABLE fused_launches ADD COLUMN IF NOT EXISTS circulating numeric(78,0);
          ALTER TABLE fused_launches ADD COLUMN IF NOT EXISTS price_x18 numeric(78,0);
          ALTER TABLE fused_social_posts ADD COLUMN IF NOT EXISTS author_display_name text;
          ALTER TABLE fused_social_posts ADD COLUMN IF NOT EXISTS avatar_url text;
          ALTER TABLE fused_social_posts ADD COLUMN IF NOT EXISTS verified boolean;
          ALTER TABLE fused_social_posts ADD COLUMN IF NOT EXISTS media jsonb NOT NULL DEFAULT '[]'::jsonb;
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
            block_time, factory, locker, dex_version, lifecycle_state, graduation_target
          ) VALUES (
            ${row.chainId}, ${row.token.toLowerCase()}, ${row.name}, ${row.symbol},
            ${row.launcher.toLowerCase()}, ${row.quote.toLowerCase()}, ${row.poolId},
            ${row.tokenId}, ${row.startTick}, ${row.lpFee}, ${row.supply}, ${row.metadataURI},
            ${row.txHash}, ${row.blockNumber.toString()}, ${row.createdAt},
            ${row.factory?.toLowerCase() ?? null}, ${row.locker?.toLowerCase() ?? null},
            ${row.dexVersion ?? "curve"}, ${row.lifecycleState ?? "CURVE"},
            ${row.graduationTarget ?? null}
          )
          ON CONFLICT (chain_id, token) DO UPDATE SET
            name = EXCLUDED.name,
            symbol = EXCLUDED.symbol,
            launcher = EXCLUDED.launcher,
            quote = EXCLUDED.quote,
            pool_id = COALESCE(fused_launches.pool_id, EXCLUDED.pool_id),
            token_id = CASE
              WHEN fused_launches.token_id IS NOT NULL AND fused_launches.token_id > 0 THEN fused_launches.token_id
              ELSE EXCLUDED.token_id
            END,
            start_tick = EXCLUDED.start_tick,
            lp_fee = EXCLUDED.lp_fee,
            supply = EXCLUDED.supply,
            metadata_uri = EXCLUDED.metadata_uri,
            tx_hash = EXCLUDED.tx_hash,
            block_number = EXCLUDED.block_number,
            block_time = COALESCE(EXCLUDED.block_time, fused_launches.block_time),
            factory = EXCLUDED.factory,
            locker = EXCLUDED.locker,
            dex_version = CASE
              WHEN fused_launches.dex_version = 'uniswap_v4' THEN fused_launches.dex_version
              ELSE EXCLUDED.dex_version
            END,
            lifecycle_state = CASE
              WHEN fused_launches.lifecycle_state = 'GRADUATED' THEN fused_launches.lifecycle_state
              ELSE COALESCE(EXCLUDED.lifecycle_state, fused_launches.lifecycle_state)
            END,
            graduation_target = COALESCE(EXCLUDED.graduation_target, fused_launches.graduation_target)
        `;
        return ok(true);
      } catch (error) {
        return err(databaseUnavailable(error instanceof Error ? error.message : "upsert failed"));
      }
    },
    updateMarket: async (row) => {
      const a = availability();
      if (a.status !== "OK") return fail(a);
      const client = conn();
      if (!client) return fail(a);
      try {
        await client`
          UPDATE fused_launches SET
            lifecycle_state = ${row.lifecycleState},
            real_quote = ${row.realQuote},
            graduation_target = ${row.graduationTarget},
            circulating = ${row.circulating},
            price_x18 = ${row.priceX18},
            token_id = COALESCE(${row.tokenId ?? null}, token_id),
            pool_id = COALESCE(${row.poolId ?? null}, pool_id),
            dex_version = ${row.dexVersion}
          WHERE chain_id = ${row.chainId} AND token = ${row.token.toLowerCase()}
        `;
        return ok(true);
      } catch (error) {
        return err(databaseUnavailable(error instanceof Error ? error.message : "market update failed"));
      }
    },
    insertTrade: async (row) => {
      const a = availability();
      if (a.status !== "OK") return fail(a);
      const client = conn();
      if (!client) return fail(a);
      try {
        const inserted = await client`
          INSERT INTO fused_trades (
            chain_id, token, tx_hash, log_index, block_number, traded_at, trader,
            is_buy, token_amount, quote_amount, price_x18, venue
          ) VALUES (
            ${row.chainId}, ${row.token.toLowerCase()}, ${row.txHash}, ${row.logIndex},
            ${row.blockNumber.toString()}, ${row.tradedAt}, ${row.trader.toLowerCase()},
            ${row.isBuy}, ${row.tokenAmount}, ${row.quoteAmount}, ${row.priceX18}, ${row.venue}
          )
          ON CONFLICT (chain_id, tx_hash, log_index) DO NOTHING
          RETURNING tx_hash
        `;
        if (inserted.length === 0) return ok(true);
        const intervals = [60, 300, 900, 3600];
        const ts = Math.floor(row.tradedAt.getTime() / 1000);
        const price = row.priceX18;
        for (const sec of intervals) {
          const start = new Date(Math.floor(ts / sec) * sec * 1000);
          await client`
            INSERT INTO fused_candles (
              chain_id, token, interval_sec, bucket_start,
              open_x18, high_x18, low_x18, close_x18, volume_token, volume_quote, trade_count
            ) VALUES (
              ${row.chainId}, ${row.token.toLowerCase()}, ${sec}, ${start},
              ${price}, ${price}, ${price}, ${price}, ${row.tokenAmount}, ${row.quoteAmount}, 1
            )
            ON CONFLICT (chain_id, token, interval_sec, bucket_start) DO UPDATE SET
              high_x18 = GREATEST(fused_candles.high_x18, EXCLUDED.high_x18),
              low_x18 = LEAST(fused_candles.low_x18, EXCLUDED.low_x18),
              close_x18 = EXCLUDED.close_x18,
              volume_token = fused_candles.volume_token + EXCLUDED.volume_token,
              volume_quote = fused_candles.volume_quote + EXCLUDED.volume_quote,
              trade_count = fused_candles.trade_count + 1
          `;
        }
        return ok(true);
      } catch (error) {
        return err(databaseUnavailable(error instanceof Error ? error.message : "trade insert failed"));
      }
    },
    applyTransfer: async (row) => {
      const a = availability();
      if (a.status !== "OK") return fail(a);
      const client = conn();
      if (!client) return fail(a);
      const zero = "0x0000000000000000000000000000000000000000";
      try {
        if (row.txHash && row.logIndex != null) {
          const claimed = await client`
            INSERT INTO fused_transfer_logs (chain_id, tx_hash, log_index)
            VALUES (${row.chainId}, ${row.txHash}, ${row.logIndex})
            ON CONFLICT (chain_id, tx_hash, log_index) DO NOTHING
            RETURNING tx_hash
          `;
          if (claimed.length === 0) return ok(true);
        }
        if (row.from.toLowerCase() !== zero) {
          await client`
            INSERT INTO fused_holders (chain_id, token, holder, balance)
            VALUES (${row.chainId}, ${row.token.toLowerCase()}, ${row.from.toLowerCase()}, 0)
            ON CONFLICT (chain_id, token, holder) DO UPDATE SET
              balance = fused_holders.balance - ${row.value}::numeric
          `;
        }
        if (row.to.toLowerCase() !== zero) {
          await client`
            INSERT INTO fused_holders (chain_id, token, holder, balance)
            VALUES (${row.chainId}, ${row.token.toLowerCase()}, ${row.to.toLowerCase()}, ${row.value}::numeric)
            ON CONFLICT (chain_id, token, holder) DO UPDATE SET
              balance = fused_holders.balance + ${row.value}::numeric
          `;
        }
        return ok(true);
      } catch (error) {
        return err(databaseUnavailable(error instanceof Error ? error.message : "transfer apply failed"));
      }
    },
    listTrades: async (chainId, token, limit = 50) => {
      const a = availability();
      if (a.status !== "OK") return fail(a);
      const client = conn();
      if (!client) return fail(a);
      try {
        const rows = await client`
          SELECT * FROM fused_trades
          WHERE chain_id = ${chainId} AND token = ${token.toLowerCase()}
          ORDER BY block_number DESC, log_index DESC
          LIMIT ${limit}
        `;
        return ok(rows as unknown as Record<string, unknown>[]);
      } catch (error) {
        return err(databaseUnavailable(error instanceof Error ? error.message : "trades failed"));
      }
    },
    listCandles: async (chainId, token, intervalSec, limit = 200) => {
      const a = availability();
      if (a.status !== "OK") return fail(a);
      const client = conn();
      if (!client) return fail(a);
      try {
        const rows = await client`
          SELECT * FROM fused_candles
          WHERE chain_id = ${chainId} AND token = ${token.toLowerCase()} AND interval_sec = ${intervalSec}
          ORDER BY bucket_start DESC
          LIMIT ${limit}
        `;
        return ok((rows as unknown as Record<string, unknown>[]).slice().reverse());
      } catch (error) {
        return err(databaseUnavailable(error instanceof Error ? error.message : "candles failed"));
      }
    },
    tokenStats: async (chainId, token) => {
      const a = availability();
      if (a.status !== "OK") return fail(a);
      const client = conn();
      if (!client) return fail(a);
      try {
        const addr = token.toLowerCase();
        const [totals] = await client`
          SELECT
            COALESCE(SUM(quote_amount), 0) AS volume_total,
            COUNT(*)::int AS trade_count,
            COALESCE(SUM(quote_amount) FILTER (WHERE traded_at >= NOW() - INTERVAL '24 hours'), 0) AS volume_24h
          FROM fused_trades
          WHERE chain_id = ${chainId} AND token = ${addr}
        `;
        const [holders] = await client`
          SELECT COUNT(*)::int AS holder_count
          FROM fused_holders h
          JOIN fused_launches l ON l.chain_id = h.chain_id AND l.token = h.token
          WHERE h.chain_id = ${chainId} AND h.token = ${addr} AND h.balance > 0
            AND h.holder NOT IN (
              '0x0000000000000000000000000000000000000000',
              '0x000000000000000000000000000000000000dead',
              COALESCE(l.factory, ''),
              COALESCE(l.locker, '')
            )
        `;
        return ok({
          volumeTotal: String(totals?.volume_total ?? 0),
          volume24h: String(totals?.volume_24h ?? 0),
          tradeCount: Number(totals?.trade_count ?? 0),
          holderCount: Number(holders?.holder_count ?? 0),
        });
      } catch (error) {
        return err(databaseUnavailable(error instanceof Error ? error.message : "stats failed"));
      }
    },
    listLaunches: async (chainId) => {
      const a = availability();
      if (a.status !== "OK") return fail(a);
      const client = conn();
      if (!client) return fail(a);
      try {
        const rows = await client`
          SELECT l.*, m.image_id, m.image_url, m.description AS app_description, m.source_platform,
                 m.source_post_id, m.source_post_url, m.source_author, m.source_excerpt,
                 (SELECT COALESCE(SUM(quote_amount), 0) FROM fused_trades t WHERE t.chain_id = l.chain_id AND t.token = l.token) AS volume_quote,
                 (SELECT COUNT(*) FROM fused_holders h WHERE h.chain_id = l.chain_id AND h.token = l.token AND h.balance > 0
                    AND h.holder NOT IN (
                      '0x0000000000000000000000000000000000000000',
                      '0x000000000000000000000000000000000000dead',
                      COALESCE(l.factory, ''),
                      COALESCE(l.locker, '')
                    )) AS holder_count
          FROM fused_launches l
          LEFT JOIN fused_token_metadata m ON m.chain_id = l.chain_id AND m.token = l.token
          WHERE l.chain_id = ${chainId}
          ORDER BY l.block_number DESC
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
          SELECT l.*, m.image_id, m.image_url, m.description AS app_description, m.source_platform,
                 m.source_post_id, m.source_post_url, m.source_author, m.source_excerpt,
                 (SELECT COALESCE(SUM(quote_amount), 0) FROM fused_trades t WHERE t.chain_id = l.chain_id AND t.token = l.token) AS volume_quote,
                 (SELECT COUNT(*) FROM fused_holders h WHERE h.chain_id = l.chain_id AND h.token = l.token AND h.balance > 0
                    AND h.holder NOT IN (
                      '0x0000000000000000000000000000000000000000',
                      '0x000000000000000000000000000000000000dead',
                      COALESCE(l.factory, ''),
                      COALESCE(l.locker, '')
                    )) AS holder_count
          FROM fused_launches l
          LEFT JOIN fused_token_metadata m ON m.chain_id = l.chain_id AND m.token = l.token
          WHERE l.chain_id = ${chainId} AND l.token = ${token.toLowerCase()}
          LIMIT 1
        `;
        const row = rows[0];
        return ok(row ? mapLaunch(row as Record<string, unknown>) : null);
      } catch (error) {
        return err(databaseUnavailable(error instanceof Error ? error.message : "get failed"));
      }
    },
    upsertTokenMetadata: async (row) => {
      const a = availability();
      if (a.status !== "OK") return fail(a);
      const client = conn();
      if (!client) return fail(a);
      try {
        await client`
          INSERT INTO fused_token_metadata (
            chain_id, token, description, image_id, image_url, source_platform,
            source_post_id, source_author, source_post_url, source_excerpt
          ) VALUES (
            ${row.chainId}, ${row.token.toLowerCase()}, ${row.description ?? ""},
            ${row.imageId ?? null}, ${row.imageUrl ?? null}, ${row.sourcePlatform ?? null},
            ${row.sourcePostId ?? null}, ${row.sourceAuthor ?? null}, ${row.sourcePostUrl ?? null},
            ${row.sourceExcerpt ?? null}
          )
          ON CONFLICT (chain_id, token) DO UPDATE SET
            description = EXCLUDED.description,
            image_id = COALESCE(EXCLUDED.image_id, fused_token_metadata.image_id),
            image_url = COALESCE(EXCLUDED.image_url, fused_token_metadata.image_url),
            source_platform = COALESCE(EXCLUDED.source_platform, fused_token_metadata.source_platform),
            source_post_id = COALESCE(EXCLUDED.source_post_id, fused_token_metadata.source_post_id),
            source_author = COALESCE(EXCLUDED.source_author, fused_token_metadata.source_author),
            source_post_url = COALESCE(EXCLUDED.source_post_url, fused_token_metadata.source_post_url),
            source_excerpt = COALESCE(EXCLUDED.source_excerpt, fused_token_metadata.source_excerpt)
        `;
        return ok(true);
      } catch (error) {
        return err(databaseUnavailable(error instanceof Error ? error.message : "metadata upsert failed"));
      }
    },
    upsertSocialPost: async (post) => {
      const a = availability();
      if (a.status !== "OK") return fail(a);
      const client = conn();
      if (!client) return fail(a);
      try {
        await client`
          INSERT INTO fused_social_posts (
            platform, post_id, author_id, author_username, author_display_name, avatar_url, verified,
            text, url, media, metrics, published_at, fetched_at
          ) VALUES (
            ${post.platform}, ${post.postId}, ${post.authorId}, ${post.authorUsername},
            ${post.authorDisplayName ?? null}, ${post.avatarUrl ?? null}, ${post.verified ?? null},
            ${post.text}, ${post.url}, ${JSON.stringify(post.media)}, ${JSON.stringify(post.metrics)},
            ${post.publishedAt}, ${post.fetchedAt}
          )
          ON CONFLICT (platform, post_id) DO UPDATE SET
            author_id = EXCLUDED.author_id,
            author_username = EXCLUDED.author_username,
            author_display_name = EXCLUDED.author_display_name,
            avatar_url = EXCLUDED.avatar_url,
            verified = EXCLUDED.verified,
            text = EXCLUDED.text,
            url = EXCLUDED.url,
            media = EXCLUDED.media,
            metrics = EXCLUDED.metrics,
            fetched_at = EXCLUDED.fetched_at
        `;
        return ok(true);
      } catch (error) {
        return err(databaseUnavailable(error instanceof Error ? error.message : "post upsert failed"));
      }
    },
    getSocialPost: async (platform, postId) => {
      const a = availability();
      if (a.status !== "OK") return fail(a);
      const client = conn();
      if (!client) return fail(a);
      try {
        const rows = await client`
          SELECT * FROM fused_social_posts WHERE platform = ${platform} AND post_id = ${postId} LIMIT 1
        `;
        const row = rows[0] as Record<string, unknown> | undefined;
        if (!row) return ok(null);
        return ok({
          platform: String(row.platform) as SocialPost["platform"],
          postId: String(row.post_id),
          authorId: String(row.author_id),
          authorUsername: String(row.author_username),
          authorDisplayName: row.author_display_name ? String(row.author_display_name) : undefined,
          avatarUrl: row.avatar_url ? String(row.avatar_url) : undefined,
          verified: typeof row.verified === "boolean" ? row.verified : undefined,
          text: String(row.text),
          url: String(row.url),
          media: Array.isArray(row.media) ? (row.media as SocialPost["media"]) : [],
          metrics: (row.metrics ?? {}) as SocialPost["metrics"],
          publishedAt: new Date(String(row.published_at)).toISOString(),
          fetchedAt: new Date(String(row.fetched_at)).toISOString(),
        });
      } catch (error) {
        return err(databaseUnavailable(error instanceof Error ? error.message : "post read failed"));
      }
    },
    upsertTrackedAccount: async (account) => {
      const a = availability();
      if (a.status !== "OK") return fail(a);
      if (!account.platformUserId) return ok(true);
      const client = conn();
      if (!client) return fail(a);
      try {
        await client`
          INSERT INTO fused_tracked_accounts (
            id, platform, platform_user_id, username, display_name, enabled, category, priority, created_at, updated_at
          ) VALUES (
            ${account.id}, ${account.platform}, ${account.platformUserId}, ${account.username},
            ${account.displayName}, ${account.enabled}, ${account.category}, ${account.priority},
            ${account.createdAt}, ${account.updatedAt}
          )
          ON CONFLICT (id) DO UPDATE SET
            platform_user_id = EXCLUDED.platform_user_id,
            username = EXCLUDED.username,
            display_name = EXCLUDED.display_name,
            enabled = EXCLUDED.enabled,
            category = EXCLUDED.category,
            priority = EXCLUDED.priority,
            updated_at = EXCLUDED.updated_at
        `;
        return ok(true);
      } catch (error) {
        return err(databaseUnavailable(error instanceof Error ? error.message : "account upsert failed"));
      }
    },
    markSocialSync: async (id, postCount) => {
      const a = availability();
      if (a.status !== "OK") return fail(a);
      const client = conn();
      if (!client) return fail(a);
      try {
        await client`
          INSERT INTO fused_social_sync (id, last_sync_at, post_count)
          VALUES (${id}, now(), ${postCount})
          ON CONFLICT (id) DO UPDATE SET last_sync_at = now(), post_count = EXCLUDED.post_count
        `;
        return ok(true);
      } catch (error) {
        return err(databaseUnavailable(error instanceof Error ? error.message : "sync write failed"));
      }
    },
    lastSocialSync: async () => {
      const a = availability();
      if (a.status !== "OK") return fail(a);
      const client = conn();
      if (!client) return fail(a);
      try {
        const rows = await client`SELECT last_sync_at, post_count FROM fused_social_sync WHERE id = 'x' LIMIT 1`;
        const row = rows[0];
        return ok({
          lastSyncAt: row?.last_sync_at ? new Date(String(row.last_sync_at)).toISOString() : null,
          postCount: row?.post_count == null ? 0 : Number(row.post_count),
        });
      } catch (error) {
        return err(databaseUnavailable(error instanceof Error ? error.message : "sync read failed"));
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
