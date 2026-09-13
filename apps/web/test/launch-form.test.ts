import assert from "node:assert/strict";
import test from "node:test";
import { validateLaunchForm } from "@fused-ai/blockchain";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

test("launch form validation rejects empty name and accepts a real ticker", () => {
  assert.ok(validateLaunchForm({ name: "", symbol: "X", metadataURI: "" }));
  assert.equal(validateLaunchForm({ name: "Fused", symbol: "FUSE", metadataURI: "" }), null);
});

test("manual launch does not require AI or X and resolves wallet clients at click time", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const launchPage = readFileSync(join(root, "src/app/launch/page.tsx"), "utf8");
  const manual = readFileSync(join(root, "src/components/ManualLaunch.tsx"), "utf8");
  assert.match(launchPage, /publicLaunchEnabled/);
  assert.match(launchPage, /Launching soon/);
  assert.equal(launchPage.includes("aiAvailability"), false);
  assert.equal(launchPage.includes("socialAvailability"), false);
  assert.match(manual, /resolveWriteClients/);
  assert.equal(manual.includes("Wallet is not ready."), false);
  assert.equal(manual.includes("useWalletClient"), false);
  assert.match(manual, /FusedFactory.create/);
  assert.match(manual, /useState\(""\)/);
  assert.match(manual, /same bonding curve/);
  assert.match(manual, /\/api\/media\/upload/);
  assert.match(manual, /\/api\/ai\/image/);
  assert.match(manual, /FusePost/);
  assert.match(manual, /applyFusedDraft/);
  assert.match(manual, /setName\(draft\.name\)/);
  assert.match(manual, /setSymbol\(draft\.ticker\)/);
  assert.match(manual, /setDescription\(draft\.description\)/);
  assert.match(manual, /logoError/);
  assert.match(manual, /Generating…/);
  assert.match(manual, /imagePrompt/);
  assert.match(manual, /Logo theme/);
  assert.equal(manual.includes("0.5"), false);
  assert.equal(manual.includes("X_BEARER_TOKEN"), false);
  assert.equal(manual.includes("AI_PROVIDER"), false);
  assert.equal(manual.includes("NEXT_PUBLIC_AI"), false);
  assert.match(manual, /LAUNCH TOKEN/);
});

test("token and explore pages do not hardcode fake market data", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const explore = readFileSync(join(root, "src/app/explore/page.tsx"), "utf8");
  const token = readFileSync(join(root, "src/app/token/[address]/page.tsx"), "utf8");
  const terminal = readFileSync(join(root, "src/components/TokenTerminal.tsx"), "utf8");
  for (const source of [explore, token, terminal]) {
    assert.equal(source.toLowerCase().includes("fake"), false);
    assert.equal(source.includes("123456789"), false);
  }
  assert.match(terminal, /marketCapWei/);
  assert.match(terminal, /volume24h/);
  assert.match(terminal, /holderCount/);
});
