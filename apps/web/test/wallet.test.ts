import assert from "node:assert/strict";
import test from "node:test";
import { walletConnectorKinds } from "../src/lib/wallet.ts";

test("injected wallets work without WalletConnect", () => {
  assert.deepEqual(walletConnectorKinds(null), ["injected"]);
  assert.deepEqual(walletConnectorKinds(""), ["injected"]);
});

test("WalletConnect is enabled only when a project id exists", () => {
  assert.deepEqual(walletConnectorKinds("abc123"), ["injected", "walletConnect"]);
});
