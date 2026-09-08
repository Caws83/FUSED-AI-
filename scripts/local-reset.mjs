#!/usr/bin/env node
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { repoRoot } from "./repo-env.mjs";
import { LOCAL_CHAIN_ID } from "./anvil-account.mjs";

const root = repoRoot();
const deployment = path.join(root, "deployments", `local-${LOCAL_CHAIN_ID}.json`);
const envLocal = path.join(root, ".env.local");
if (existsSync(deployment)) unlinkSync(deployment);
if (existsSync(envLocal)) {
  writeFileSync(
    envLocal,
    `# Cleared by npm run local:reset. Restart Anvil, then npm run contracts:deploy:local.\n`,
  );
}
console.log("Cleared local deployment addresses.");
console.log("Restart Anvil (npm run chain) so the chain is empty, then redeploy.");
console.log("Optional: docker compose down && docker compose up -d  (resets Postgres data if you also remove the volume).");
