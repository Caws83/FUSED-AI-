import assert from "node:assert/strict";
import test from "node:test";
import { chainLabelFor, walletConnectorKinds, writeClientError } from "../src/lib/wallet.ts";

test("injected wallets work without WalletConnect", () => {
  assert.deepEqual(walletConnectorKinds(null), ["injected"]);
  assert.deepEqual(walletConnectorKinds(""), ["injected"]);
});

test("WalletConnect is enabled only when a project id exists", () => {
  assert.deepEqual(walletConnectorKinds("abc123"), ["injected", "walletConnect"]);
});

test("write-client errors distinguish account, chain, rpc, and wallet", () => {
  assert.equal(writeClientError("account"), "Connect a wallet to continue.");
  assert.equal(writeClientError("chain"), "Switch your wallet to the Fused chain.");
  assert.equal(writeClientError("rpc"), "The local chain is not reachable.");
  assert.equal(writeClientError("wallet"), "Reconnect the wallet and try again.");
});

test("chain labels use the live chain id, not a hardcoded Fused Local string", () => {
  assert.equal(chainLabelFor(31337), "Fused Local");
  assert.equal(chainLabelFor(1), "Chain 1");
  assert.equal(chainLabelFor(null), undefined);
});
