import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ARC_TESTNET_LAUNCH,
  ROBINHOOD_TESTNET_LAUNCH_V2,
  WALLET_SELECTOR_CHAIN_IDS,
  nativeCurrencyFor,
  newLaunchForWallet,
} from "@fused-ai/config";
import { resolveLaunchIdentity } from "../src/lib/launches.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("wallet 46630 launches on Robinhood V2 and 5042002 launches on Arc", () => {
  assert.equal(newLaunchForWallet(46630)?.factory, ROBINHOOD_TESTNET_LAUNCH_V2.factory);
  assert.equal(newLaunchForWallet(5042002)?.factory, ARC_TESTNET_LAUNCH.factory);
  assert.notEqual(newLaunchForWallet(46630)?.factory, newLaunchForWallet(5042002)?.factory);
});

test("unsupported chain has no launch factory", () => {
  assert.equal(newLaunchForWallet(1), null);
  assert.equal(newLaunchForWallet(8453), null);
  assert.equal(newLaunchForWallet(4663), null);
  assert.equal(newLaunchForWallet(5042), null);
  assert.equal(newLaunchForWallet(undefined), null);
});

test("Robinhood currency is ETH and Arc currency is USDC", () => {
  assert.equal(nativeCurrencyFor(46630).symbol, "ETH");
  assert.equal(nativeCurrencyFor(5042002).symbol, "USDC");
});

test("network selector only exposes Robinhood and Arc testnets", () => {
  const selector = readFileSync(join(root, "src/components/NetworkSelector.tsx"), "utf8");
  assert.match(selector, /WALLET_SELECTOR_CHAIN_IDS/);
  assert.deepEqual([...WALLET_SELECTOR_CHAIN_IDS], [46630, 5042002]);
  assert.equal(selector.includes("ARC_MAINNET_CHAIN_ID"), false);
  assert.equal(selector.includes("ROBINHOOD_MAINNET_CHAIN_ID"), false);
  assert.match(selector, /switchChain/);
});

test("Connect Wallet is one header button until connectors are revealed", () => {
  const wallet = readFileSync(join(root, "../../packages/ui/src/WalletButton.tsx"), "utf8");
  const connect = readFileSync(join(root, "src/components/ConnectWallet.tsx"), "utf8");
  const providers = readFileSync(join(root, "src/components/Providers.tsx"), "utf8");
  assert.match(wallet, /Connect Wallet/);
  assert.match(wallet, /connectorMenuOpen/);
  assert.match(connect, /onToggleConnectorMenu/);
  assert.match(connect, /connect\(\{ connector, chainId: preferredChainId \}\)/);
  assert.match(providers, /ROBINHOOD_TESTNET_CHAIN_ID/);
  assert.match(providers, /ARC_TESTNET_CHAIN_ID/);
  assert.match(providers, /chains/);
});

test("Fuse-a-Post uses wallet chain at CREATE time, not AI time", () => {
  const fuse = readFileSync(join(root, "src/components/FusePost.tsx"), "utf8");
  const manual = readFileSync(join(root, "src/components/ManualLaunch.tsx"), "utf8");
  assert.equal(fuse.includes("writeContract"), false);
  assert.equal(fuse.includes("newLaunchForWallet"), false);
  assert.match(manual, /async function onLaunch/);
  assert.match(manual, /const live = newLaunchForWallet\(walletChainId\)/);
});

test("existing token pages require the token chain, not the launch selector chain", () => {
  const tokenPage = readFileSync(join(root, "src/app/token/[address]/page.tsx"), "utf8");
  const terminal = readFileSync(join(root, "src/components/TokenTerminal.tsx"), "utf8");
  const trade = readFileSync(join(root, "src/components/TradePanel.tsx"), "utf8");
  const launches = readFileSync(join(root, "src/lib/launches.ts"), "utf8");
  const boards = readFileSync(join(root, "src/lib/boards.tsx"), "utf8");
  assert.match(tokenPage, /loaded\.launch\.chainId/);
  assert.match(tokenPage, /parseSupportedChainId/);
  assert.match(terminal, /expectedChainId=\{chainId\}/);
  assert.match(terminal, /live\?chainId=\$\{chainId\}/);
  assert.match(trade, /Switch to \$\{tokenNetworkName\}/);
  assert.match(launches, /ROBINHOOD_TESTNET_CHAIN_ID/);
  assert.match(launches, /launchContractsForChain\(chainId\)/);
  assert.match(launches, /INDEXED_BOARD_CHAIN_IDS/);
  assert.match(boards, /chainId=\$\{launch\.chainId\}/);
  assert.equal(tokenPage.includes("newLaunchForWallet"), false);
});

test("duplicate token addresses on two chains fail closed without chainId", () => {
  const token = "0xabc";
  const rh = { chainId: 46630, token } as { chainId: number; token: string };
  const arc = { chainId: 5042002, token } as { chainId: number; token: string };
  assert.equal(resolveLaunchIdentity([rh as never], null).status, "found");
  assert.equal(resolveLaunchIdentity([rh as never, arc as never], null).status, "ambiguous");
  const picked = resolveLaunchIdentity([rh as never, arc as never], 5042002);
  assert.equal(picked.status, "found");
  if (picked.status === "found") assert.equal(picked.launch.chainId, 5042002);
});
