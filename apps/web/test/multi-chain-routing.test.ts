import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ARC_MAINNET_LAUNCH,
  ARC_TESTNET_LAUNCH,
  ROBINHOOD_MAINNET_LAUNCH_V2,
  ROBINHOOD_TESTNET_LAUNCH_V2,
  WALLET_SELECTOR_CHAIN_IDS,
  nativeCurrencyFor,
  newLaunchForWallet,
} from "@fused-ai/config";
import { resolveLaunchIdentity } from "../src/lib/launches.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("wallet 4663 launches on Robinhood Mainnet V2 and 5042 launches on Arc Mainnet", () => {
  assert.equal(newLaunchForWallet(4663)?.factory, ROBINHOOD_MAINNET_LAUNCH_V2.factory);
  assert.equal(newLaunchForWallet(5042)?.factory, ARC_MAINNET_LAUNCH.factory);
  assert.notEqual(newLaunchForWallet(4663)?.factory, newLaunchForWallet(5042)?.factory);
  assert.notEqual(newLaunchForWallet(4663)?.factory, ROBINHOOD_TESTNET_LAUNCH_V2.factory);
  assert.notEqual(newLaunchForWallet(5042)?.factory, ARC_TESTNET_LAUNCH.factory);
});

test("unsupported chain has no launch factory", () => {
  assert.equal(newLaunchForWallet(1), null);
  assert.equal(newLaunchForWallet(8453), null);
  assert.equal(newLaunchForWallet(46630), null);
  assert.equal(newLaunchForWallet(5042002), null);
  assert.equal(newLaunchForWallet(undefined), null);
});

test("Robinhood currency is ETH and Arc currency is USDC", () => {
  assert.equal(nativeCurrencyFor(46630).symbol, "ETH");
  assert.equal(nativeCurrencyFor(5042002).symbol, "USDC");
  assert.equal(nativeCurrencyFor(5042).symbol, "USDC");
});

test("network selector exposes Robinhood Mainnet and Arc Mainnet", () => {
  const selector = readFileSync(join(root, "src/components/NetworkSelector.tsx"), "utf8");
  assert.match(selector, /WALLET_SELECTOR_CHAIN_IDS/);
  assert.deepEqual([...WALLET_SELECTOR_CHAIN_IDS], [4663, 5042]);
  assert.match(selector, /ROBINHOOD_MAINNET_CHAIN_ID/);
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
  assert.match(providers, /ROBINHOOD_MAINNET_CHAIN_ID/);
  assert.match(providers, /ROBINHOOD_TESTNET_CHAIN_ID/);
  assert.match(providers, /ARC_MAINNET_CHAIN_ID/);
  assert.match(providers, /ARC_TESTNET_CHAIN_ID/);
  assert.match(providers, /chains/);
});

test("mobile header keeps one connect control and moves network into the menu", () => {
  const header = readFileSync(join(root, "src/components/SiteHeader.tsx"), "utf8");
  const css = readFileSync(join(root, "../../packages/ui/src/styles.css"), "utf8");
  assert.match(header, /fused-nav-mobile-tools/);
  assert.match(header, /fused-nav-desktop-tools/);
  assert.match(header, /Open menu/);
  assert.match(css, /fused-nav-desktop-tools/);
  assert.match(css, /white-space: nowrap/);
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
