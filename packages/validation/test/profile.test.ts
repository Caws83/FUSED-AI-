import assert from "node:assert/strict";
import test from "node:test";
import {
  FUSED_PROFILE_NAME_MAX,
  fusedProfileUpdateMessage,
  parseFusedDisplayName,
  parseFusedPfpUrl,
  parseFusedProfileUpdate,
} from "../src/index.ts";

const ADDRESS = "0xf5fD7A1e4C2B3A9D8E7C6B5A493827160192EE00";
const SIGNATURE = `0x${"ab".repeat(65)}`;

test("display names are clamped, stripped of HTML, and required", () => {
  assert.equal(parseFusedDisplayName("Ada"), "Ada");
  assert.equal(parseFusedDisplayName("  Ada  "), "Ada");
  assert.equal(parseFusedDisplayName("<b>Ada</b>"), "Ada");
  assert.equal(parseFusedDisplayName(""), null);
  assert.equal(parseFusedDisplayName("   "), null);
  assert.equal(parseFusedDisplayName("a".repeat(FUSED_PROFILE_NAME_MAX + 8))?.length, FUSED_PROFILE_NAME_MAX);
});

test("pfp URLs allow https and local media paths only", () => {
  assert.deepEqual(parseFusedPfpUrl(""), { ok: true, url: null });
  assert.deepEqual(parseFusedPfpUrl(null), { ok: true, url: null });
  assert.deepEqual(parseFusedPfpUrl(`/api/media/${"a".repeat(32)}.png`), {
    ok: true,
    url: `/api/media/${"a".repeat(32)}.png`,
  });
  assert.equal(parseFusedPfpUrl("https://cdn.example/pfp.png").ok, true);
  assert.equal(parseFusedPfpUrl("javascript:alert(1)").ok, false);
  assert.equal(parseFusedPfpUrl("data:image/png;base64,aaa").ok, false);
  assert.equal(parseFusedPfpUrl("//evil.example/x.png").ok, false);
});

test("signed profile updates bind wallet, name, pfp, nonce, and signature", () => {
  const parsed = parseFusedProfileUpdate({
    address: ADDRESS,
    displayName: "Ada",
    pfpUrl: "https://cdn.example/pfp.png",
    nonce: 0,
    signature: SIGNATURE,
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) throw new Error("expected ok");
  const message = fusedProfileUpdateMessage({
    address: parsed.address,
    displayName: parsed.displayName,
    pfpUrl: parsed.pfpUrl ?? "",
    nonce: parsed.nonce,
  });
  assert.match(message, /FUSED profile update/);
  assert.match(message, new RegExp(`address:${ADDRESS}`));
  assert.match(message, /name:Ada/);
  assert.match(message, /pfp:https:\/\/cdn\.example\/pfp\.png/);
  assert.match(message, /nonce:0/);
  assert.equal(parseFusedProfileUpdate({ address: ADDRESS, displayName: "Ada", nonce: 0 }).ok, false);
  assert.equal(
    parseFusedProfileUpdate({
      address: ADDRESS,
      displayName: "Ada",
      nonce: 0,
      signature: "0xdead",
    }).ok,
    false,
  );
});
