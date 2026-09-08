#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PERMIT2, LOCAL_RPC_URL } from "./anvil-account.mjs";
import { repoRoot } from "./repo-env.mjs";

/** Official Uniswap Permit2 etch helper used by LaunchFactory (via remappings). */
export function permit2DeploySourcePath() {
  return path.join(
    repoRoot(),
    "upstream/openlaunch/contracts/lib/v4-periphery/lib/permit2/test/utils/DeployPermit2.sol",
  );
}

export function extractPermit2Bytecode(source) {
  const match = source.match(/bytes memory bytecode =\s*hex"([0-9a-fA-F]+)"/);
  if (!match) throw new Error("Could not extract Permit2 bytecode from DeployPermit2.sol");
  return `0x${match[1]}`;
}

export async function rpc(method, params = [], rpcUrl = LOCAL_RPC_URL) {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = await res.json();
  if (body.error) throw new Error(`${method}: ${body.error.message || JSON.stringify(body.error)}`);
  return body.result;
}

export async function getCode(address, rpcUrl = LOCAL_RPC_URL) {
  return rpc("eth_getCode", [address, "latest"], rpcUrl);
}

/**
 * forge `vm.etch` does not persist to Anvil. LaunchFactory.launch calls Permit2,
 * so the official precompiled bytecode must be set via anvil_setCode.
 */
export async function etchPermit2(rpcUrl = LOCAL_RPC_URL) {
  const file = permit2DeploySourcePath();
  if (!existsSync(file)) throw new Error(`Missing Permit2 helper at ${file}`);
  const bytecode = extractPermit2Bytecode(readFileSync(file, "utf8"));
  const existing = await getCode(PERMIT2, rpcUrl);
  if (existing && existing !== "0x" && existing.length > 10) {
    return { address: PERMIT2, etched: false, bytes: (existing.length - 2) / 2 };
  }
  await rpc("anvil_setCode", [PERMIT2, bytecode], rpcUrl);
  const code = await getCode(PERMIT2, rpcUrl);
  if (!code || code === "0x") throw new Error("anvil_setCode failed: Permit2 still empty");
  return { address: PERMIT2, etched: true, bytes: (code.length - 2) / 2 };
}

const isMain = process.argv[1] && /etch-permit2\.mjs$/.test(process.argv[1].replaceAll("\\", "/"));
if (isMain) {
  etchPermit2()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
