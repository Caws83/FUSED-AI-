import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { walletHeaderCopy } from "../../../packages/ui/src/walletHeader.ts";
import { chainLabelFor, walletConnectorKinds, writeClientError } from "../src/lib/wallet.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("injected wallets work without WalletConnect", () => {
  assert.deepEqual(walletConnectorKinds(null), ["injected"]);
  assert.deepEqual(walletConnectorKinds(""), ["injected"]);
});

test("WalletConnect is enabled only when a project id exists", () => {
  assert.deepEqual(walletConnectorKinds("abc123"), ["injected", "walletConnect"]);
});

test("write-client errors distinguish account, chain, rpc, and confirm-in-wallet", () => {
  assert.equal(writeClientError("account"), "Connect a wallet to continue.");
  assert.equal(writeClientError("chain"), "Switch your wallet to this network.");
  assert.equal(writeClientError("rpc"), "The chain is not reachable.");
  assert.equal(writeClientError("wallet"), "Confirm in your wallet.");
});

test("chain labels cover local, Robinhood testnet, and Robinhood mainnet", () => {
  assert.equal(chainLabelFor(31337), "Fused Local");
  assert.equal(chainLabelFor(46630), "Robinhood Testnet");
  assert.equal(chainLabelFor(4663), "Robinhood Chain");
  assert.equal(chainLabelFor(1), "Chain 1");
  assert.equal(chainLabelFor(null), undefined);
});

test("header never shows Reconnect Wallet when an account exists", () => {
  assert.equal(
    walletHeaderCopy({
      address: "0x1234567890abcdef1234567890abcdef12345678",
      connected: false,
      pending: true,
    }),
    "Disconnect",
  );
  assert.equal(
    walletHeaderCopy({
      address: "0x1234567890abcdef1234567890abcdef12345678",
      connected: true,
      wrongNetwork: true,
    }),
    "Switch Network",
  );
  assert.equal(walletHeaderCopy({ pending: true }), "Connecting…");
  assert.equal(walletHeaderCopy({}), "Connect Wallet");
  assert.equal(JSON.stringify(walletHeaderCopy({ address: "0xabc", connected: false })).includes("Reconnect"), false);
});

test("wallet connection persists across pages instead of prompting MetaMask again", () => {
  const config = readFileSync(join(root, "src/lib/wagmi-config.ts"), "utf8");
  const providers = readFileSync(join(root, "src/components/Providers.tsx"), "utf8");
  const layout = readFileSync(join(root, "src/app/layout.tsx"), "utf8");
  const header = readFileSync(join(root, "src/components/SiteHeader.tsx"), "utf8");
  assert.match(config, /cookieStorage/);
  assert.match(providers, /initialState/);
  assert.match(providers, /reconnectOnMount/);
  assert.match(layout, /cookieToInitialState/);
  assert.match(header, /from "next\/link"/);
  assert.match(header, /link=\{Link\}/);
});
