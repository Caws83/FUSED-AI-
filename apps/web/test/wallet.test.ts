import assert from "node:assert/strict";
import test from "node:test";
import { walletHeaderCopy } from "../../../packages/ui/src/walletHeader.ts";
import { chainLabelFor, walletConnectorKinds, writeClientError } from "../src/lib/wallet.ts";

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

test("chain labels cover local, Robinhood, Arc, and unknown chains", () => {
  assert.equal(chainLabelFor(31337), "Fused Local");
  assert.equal(chainLabelFor(46630), "Robinhood Testnet");
  assert.equal(chainLabelFor(4663), "Robinhood Chain");
  assert.equal(chainLabelFor(5042002), "Arc Testnet");
  assert.equal(chainLabelFor(5042), "Arc");
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
