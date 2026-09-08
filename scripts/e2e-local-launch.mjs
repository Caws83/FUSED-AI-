#!/usr/bin/env node
import { createPublicClient, createWalletClient, http, parseEventLogs } from "viem";
import { anvil } from "viem/chains";
import { ANVIL_ACCOUNT_0, LOCAL_RPC_URL, PERMIT2 } from "./anvil-account.mjs";
import { loadRepoEnv } from "./repo-env.mjs";
import { etchPermit2, getCode } from "./etch-permit2.mjs";
import { LAUNCH_FACTORY_ABI, LAUNCH_TOKEN_ABI, POSITION_MANAGER_ABI, toLaunchParams } from "@fused-ai/blockchain";

loadRepoEnv();
const factory = process.env.LAUNCH_FACTORY_ADDRESS;
const locker = process.env.LAUNCH_LOCKER_ADDRESS;
const posm = process.env.UNISWAP_POSITION_MANAGER_ADDRESS;
if (!factory || !locker || !posm) {
  console.error("Missing local contract addresses. Deploy first.");
  process.exit(1);
}

await etchPermit2(LOCAL_RPC_URL);
const permit2Code = await getCode(PERMIT2);
if (!permit2Code || permit2Code === "0x") {
  console.error("Permit2 has no bytecode on Anvil. Launch cannot succeed.");
  process.exit(1);
}

const chain = { ...anvil, rpcUrls: { default: { http: [LOCAL_RPC_URL] }, public: { http: [LOCAL_RPC_URL] } } };
const publicClient = createPublicClient({ chain, transport: http(LOCAL_RPC_URL) });
const walletClient = createWalletClient({
  account: ANVIL_ACCOUNT_0.address,
  chain,
  transport: http(LOCAL_RPC_URL),
});
const params = toLaunchParams({
  name: "Local Fuse",
  symbol: "LFUSE",
  metadataURI: "local://e2e",
  creator: ANVIL_ACCOUNT_0.address,
});

const { request, result: simulated } = await publicClient.simulateContract({
  address: factory,
  abi: LAUNCH_FACTORY_ABI,
  functionName: "launch",
  args: [params],
  account: ANVIL_ACCOUNT_0.address,
});
const hash = await walletClient.writeContract(request);
const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") {
  console.error("launch failed", hash);
  process.exit(1);
}
const launched = parseEventLogs({ abi: LAUNCH_FACTORY_ABI, logs: receipt.logs, eventName: "Launched" })[0];
if (!launched) {
  console.error("no Launched event");
  process.exit(1);
}
const token = launched.args.token;
const tokenId = launched.args.tokenId;
const bytecode = await publicClient.getCode({ address: token });
const owner = await publicClient.readContract({ address: posm, abi: POSITION_MANAGER_ABI, functionName: "ownerOf", args: [tokenId] });
const liquidity = await publicClient.readContract({
  address: posm,
  abi: POSITION_MANAGER_ABI,
  functionName: "getPositionLiquidity",
  args: [tokenId],
});
const name = await publicClient.readContract({ address: token, abi: LAUNCH_TOKEN_ABI, functionName: "name" });
const report = {
  txHash: hash,
  token,
  tokenId: tokenId.toString(),
  simulatedToken: simulated?.[0],
  bytecodeBytes: bytecode ? (bytecode.length - 2) / 2 : 0,
  lockerOwner: owner,
  expectedLocker: locker,
  liquidity: liquidity.toString(),
  name,
  launcher: launched.args.launcher,
  blockNumber: receipt.blockNumber.toString(),
};
console.log(JSON.stringify(report, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2));
if (owner.toLowerCase() !== locker.toLowerCase()) process.exit(1);
if (liquidity === 0n) process.exit(1);
if (!bytecode || bytecode === "0x") process.exit(1);
if (launched.args.launcher.toLowerCase() !== ANVIL_ACCOUNT_0.address.toLowerCase()) process.exit(1);
