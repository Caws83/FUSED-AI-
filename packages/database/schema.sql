-- Fused AI index schema.
-- Applied only when DATABASE_URL is set. Empty tables; no seed rows.
-- Amounts are wei as numeric(78,0). Addresses lowercase hex.
-- Source of truth is the chain.

CREATE TABLE IF NOT EXISTS fused_migrations (
  id            bigserial PRIMARY KEY,
  schema_sha256 text NOT NULL,
  applied_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fused_tracked_accounts (
  id                 text PRIMARY KEY,
  platform           text NOT NULL,
  platform_user_id   text NOT NULL,
  username           text NOT NULL,
  display_name       text NOT NULL,
  enabled            boolean NOT NULL DEFAULT true,
  category           text NOT NULL,
  priority           integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL,
  updated_at         timestamptz NOT NULL,
  UNIQUE (platform, platform_user_id)
);

CREATE TABLE IF NOT EXISTS fused_social_posts (
  platform           text NOT NULL,
  post_id            text NOT NULL,
  author_id          text NOT NULL,
  author_username    text NOT NULL,
  author_display_name text,
  avatar_url         text,
  verified           boolean,
  text               text NOT NULL,
  url                text NOT NULL,
  media              jsonb NOT NULL DEFAULT '[]'::jsonb,
  metrics            jsonb NOT NULL,
  published_at       timestamptz NOT NULL,
  fetched_at         timestamptz NOT NULL,
  PRIMARY KEY (platform, post_id)
);

CREATE TABLE IF NOT EXISTS fused_social_sync (
  id                 text PRIMARY KEY,
  last_sync_at       timestamptz,
  post_count         integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS fused_token_metadata (
  chain_id           integer NOT NULL,
  token              text NOT NULL,
  description        text NOT NULL DEFAULT '',
  image_id           text,
  image_url          text,
  source_platform    text,
  source_post_id     text,
  source_author      text,
  source_post_url    text,
  source_excerpt     text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, token)
);

CREATE TABLE IF NOT EXISTS fused_launch_drafts (
  id                 bigserial PRIMARY KEY,
  platform           text NOT NULL,
  post_id            text NOT NULL,
  draft              jsonb NOT NULL,
  validation_ok      boolean NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fused_launches (
  chain_id           integer NOT NULL,
  token              text NOT NULL,
  name               text NOT NULL DEFAULT '',
  symbol             text NOT NULL DEFAULT '',
  launcher           text NOT NULL,
  quote              text NOT NULL,
  pool_id            text,
  token_id           numeric(78,0),
  start_tick         integer,
  lp_fee             integer,
  supply             numeric(78,0),
  metadata_uri       text NOT NULL DEFAULT '',
  tx_hash            text NOT NULL,
  block_number       bigint NOT NULL,
  block_time         timestamptz,
  factory            text,
  locker             text,
  dex_version        text NOT NULL DEFAULT 'v4',
  source_post_url    text,
  PRIMARY KEY (chain_id, token)
);

CREATE TABLE IF NOT EXISTS fused_tokenized_assets (
  chain_id           integer NOT NULL,
  contract_address   text NOT NULL,
  issuer             text NOT NULL,
  symbol             text NOT NULL,
  name               text NOT NULL,
  decimals           integer NOT NULL,
  oracle             jsonb NOT NULL,
  enabled            boolean NOT NULL,
  jurisdictions      jsonb NOT NULL,
  source_registry    text NOT NULL,
  verified_at        timestamptz NOT NULL,
  PRIMARY KEY (chain_id, contract_address)
);

CREATE TABLE IF NOT EXISTS fused_sync_cursor (
  chain_id           integer PRIMARY KEY,
  block_number       bigint NOT NULL,
  updated_at         timestamptz NOT NULL DEFAULT now()
);
