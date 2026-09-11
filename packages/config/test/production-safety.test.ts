import assert from "node:assert/strict";
import test from "node:test";
import {
  isKnownAnvilCreateAddress,
  isLocalhostUrl,
  isPrivateRailwayUrl,
  isProductionEnv,
  shouldRejectAnvilAddress,
  shouldRejectLocalhostUrl,
  shouldRejectPrivateRailwayUrl,
} from "../src/production-safety.ts";

test("known Anvil CREATE addresses are detected", () => {
  assert.equal(isKnownAnvilCreateAddress("0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"), true);
  assert.equal(isKnownAnvilCreateAddress("0x75537828f2ce51be7289709686A69CbFDbB714F1"), true);
  assert.equal(isKnownAnvilCreateAddress("0x5FbDB2315678afecb367f032d93F642f64180aa3"), true);
  assert.equal(isKnownAnvilCreateAddress("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"), true);
  assert.equal(isKnownAnvilCreateAddress("0x000000000022D473030F116dDEE9F6B43aC78BA3"), false);
});

test("localhost URLs include Postgres and RPC", () => {
  assert.equal(isLocalhostUrl("http://127.0.0.1:8545"), true);
  assert.equal(isLocalhostUrl("http://localhost:8545"), true);
  assert.equal(isLocalhostUrl("postgres://fused:fused@127.0.0.1:5432/fused_ai"), true);
  assert.equal(isLocalhostUrl("https://rpc.example.com"), false);
});

test("production rejects localhost URLs", () => {
  assert.equal(shouldRejectLocalhostUrl("http://127.0.0.1:8545", { NODE_ENV: "production" }), true);
  assert.equal(shouldRejectLocalhostUrl("http://127.0.0.1:8545", { NODE_ENV: "development" }), false);
});

test("Anvil addresses are allowed only on local non-production 31337", () => {
  const factory = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
  assert.equal(shouldRejectAnvilAddress(factory, 31337, { NODE_ENV: "development" }), false);
  assert.equal(shouldRejectAnvilAddress(factory, 31337, { NODE_ENV: "production" }), true);
  assert.equal(shouldRejectAnvilAddress(factory, 4663, { NODE_ENV: "development" }), true);
  assert.equal(shouldRejectAnvilAddress(factory, 4663, { NODE_ENV: "production" }), true);
});

test("Vercel preview is treated as production", () => {
  assert.equal(isProductionEnv({ VERCEL_ENV: "preview" }), true);
  assert.equal(isProductionEnv({ NODE_ENV: "development" }), false);
});

test("Vercel rejects Railway private DNS DATABASE_URL", () => {
  const internal = "postgres://postgres:x@postgres.railway.internal:5432/railway";
  const pub = "postgres://postgres:x@altaria.proxy.rlwy.net:49142/railway";
  assert.equal(isPrivateRailwayUrl(internal), true);
  assert.equal(isPrivateRailwayUrl(pub), false);
  assert.equal(shouldRejectPrivateRailwayUrl(internal, { VERCEL: "1" }), true);
  assert.equal(shouldRejectPrivateRailwayUrl(internal, {}), false);
  assert.equal(shouldRejectPrivateRailwayUrl(pub, { VERCEL: "1" }), false);
});
