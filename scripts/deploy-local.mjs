#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { ANVIL_ACCOUNT_0, LOCAL_RPC_URL } from "./anvil-account.mjs";
import { foundryBin, repoRoot } from "./repo-env.mjs";
import { parseForgeLabels, writeDeployment, writeLocalEnv } from "./write-local-env.mjs";
import { etchPermit2 } from "./etch-permit2.mjs";

const root = repoRoot();
const forge = foundryBin("forge");
const env = {
  ...process.env,
  DEPLOYER_PRIVATE_KEY: process.env.DEPLOYER_PRIVATE_KEY || ANVIL_ACCOUNT_0.privateKey,
};

const result = spawnSync(
  forge,
  [
    "script",
    "script/local/DeployLocalStack.s.sol:DeployLocalStack",
    "--sig",
    "deployAll()",
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

const permit2 = await etchPermit2(LOCAL_RPC_URL);
console.log(`permit2 ${permit2.address} (${permit2.etched ? "etched" : "already present"}, ${permit2.bytes} bytes)`);

const labels = parseForgeLabels(`${result.stdout}\n${result.stderr}`);
const required = ["poolManager", "permit2", "positionManager", "launchFactory", "launchLocker"];
for (const key of required) {
  if (!labels[key]) {
    console.error(`Missing ${key} in forge output`);
    process.exit(1);
  }
}

const { file, payload } = writeDeployment(labels, {
  deployBlock: labels.deployBlock ? Number(labels.deployBlock) : 0,
});
const envFile = writeLocalEnv(payload);
console.log(`wrote ${file}`);
console.log(`wrote ${envFile}`);
