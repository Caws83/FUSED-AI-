import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { databaseUnavailable, type Availability } from "@fused-ai/types";
import { err, fail, ok, type Result } from "@fused-ai/shared";
import { databaseAvailability, type FusedEnv } from "@fused-ai/config";
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
    imageUrl: row.image_url ? String(row.image_url) : null,
    appDescription: row.app_description != null ? String(row.app_description) : null,
    sourcePlatform: row.source_platform ? String(row.source_platform) : null,
    sourcePostId: row.source_post_id ? String(row.source_post_id) : null,
    sourcePostUrl: row.source_post_url ? String(row.source_post_url) : null,
    sourceAuthor: row.source_author ? String(row.source_author) : null,
    sourceExcerpt: row.source_excerpt ? String(row.source_excerpt) : null,
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
          SELECT l.*, m.image_url, m.description AS app_description, m.source_platform,
                 m.source_post_id, m.source_post_url, m.source_author, m.source_excerpt
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
          SELECT l.*, m.image_url, m.description AS app_description, m.source_platform,
                 m.source_post_id, m.source_post_url, m.source_author, m.source_excerpt
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
