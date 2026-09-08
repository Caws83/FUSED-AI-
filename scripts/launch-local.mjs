#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { ANVIL_ACCOUNT_0, LOCAL_RPC_URL } from "./anvil-account.mjs";
import { foundryBin, loadRepoEnv, repoRoot } from "./repo-env.mjs";
import { parseForgeLabels } from "./write-local-env.mjs";

loadRepoEnv();
const root = repoRoot();
const forge = foundryBin("forge");
const env = {
  ...process.env,
  DEPLOYER_PRIVATE_KEY: process.env.DEPLOYER_PRIVATE_KEY || ANVIL_ACCOUNT_0.privateKey,
  LAUNCH_NAME: process.env.LAUNCH_NAME || "Local Fuse",
  LAUNCH_SYMBOL: process.env.LAUNCH_SYMBOL || "LFUSE",
};

if (!env.LAUNCH_FACTORY_ADDRESS) {
  console.error("LAUNCH_FACTORY_ADDRESS missing. Run npm run contracts:deploy:local first.");
  process.exit(1);
}

const result = spawnSync(
  forge,
  [
    "script",
    "script/local/LaunchLocalToken.s.sol:LaunchLocalToken",
    "--rpc-url",
    LOCAL_RPC_URL,
    "--broadcast",
    "--unlocked",
    "--sender",
    ANVIL_ACCOUNT_0.address,
    "-vv",
  ],
  { cwd: `${root}/contracts`, env, encoding: "utf8" },
);
process.stdout.write(result.stdout || "");
process.stderr.write(result.stderr || "");
if (result.status !== 0) process.exit(result.status ?? 1);
const labels = parseForgeLabels(`${result.stdout}\n${result.stderr}`);
console.log(JSON.stringify(labels, null, 2));
