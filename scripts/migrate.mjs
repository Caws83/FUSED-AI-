#!/usr/bin/env node
import { loadRepoEnv, loadEnv } from "@fused-ai/config";
import { createDatabaseClient } from "@fused-ai/database";

loadRepoEnv();
const db = createDatabaseClient(loadEnv());
const migrated = await db.migrate();
if (!migrated.ok) {
  console.error(migrated.error);
  process.exit(1);
}
const ping = await db.ping();
if (!ping.ok) {
  console.error(ping.error);
  process.exit(1);
}
await db.close();
console.log("Postgres schema applied.");
