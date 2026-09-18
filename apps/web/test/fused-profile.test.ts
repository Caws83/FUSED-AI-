import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { getAddress, verifyMessage } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { loadEnv, loadRepoEnv } from "@fused-ai/config";
import { fusedProfileUpdateMessage } from "@fused-ai/validation";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function src(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

test("POST /api/social/posts still does not sign or use SIWE", () => {
  const route = src("src/app/api/social/posts/route.ts");
  assert.equal(route.includes("siwe"), false);
  assert.equal(route.includes("signMessage"), false);
  assert.equal(route.includes("verifyMessage"), false);
});

test("profile Save is an off-chain signed update with nonce replay protection", () => {
  const route = src("src/app/api/social/profile/route.ts");
  const update = src("src/lib/profile-update.ts");
  const editor = src("src/components/EditProfile.tsx");
  assert.match(route, /applySignedFusedProfile/);
  assert.match(route, /readFusedProfile/);
  assert.match(update, /verifyMessage/);
  assert.match(update, /fusedProfileUpdateMessage/);
  assert.match(update, /expectedNonce/);
  assert.match(update, /This profile update was already used/);
  assert.equal(update.includes("siwe"), false);
  assert.equal(update.includes("sendTransaction"), false);
  assert.equal(update.includes("writeContract"), false);
  assert.equal(route.includes("siwe"), false);
  assert.equal(route.includes("sendTransaction"), false);
  assert.equal(route.includes("writeContract"), false);
  assert.match(editor, /signMessageAsync/);
  assert.match(editor, /fusedProfileUpdateMessage/);
  assert.match(editor, /\/api\/media\/upload/);
  assert.match(editor, /Save Profile/);
  assert.equal(editor.includes("sendTransaction"), false);
  assert.equal(editor.includes("writeContract"), false);
  assert.equal(editor.includes("siwe"), false);
});

test("feed cards keep PFP and wallet, and Edit Profile lives in the header menu", () => {
  const card = readFileSync(join(root, "../../packages/ui/src/PostCard.tsx"), "utf8");
  const feed = src("src/components/FeedPosts.tsx");
  const page = src("src/app/trending/page.tsx");
  const header = src("src/components/SiteHeader.tsx");
  const menu = src("src/components/ProfileMenu.tsx");
  assert.match(card, /avatarUrl/);
  assert.match(card, /fused-post-subline/);
  assert.equal(feed.includes("displayName="), false);
  assert.match(feed, /avatarUrl=\{post\.avatarUrl\}/);
  assert.match(feed, /writeFuseHandoff\(text\)/);
  assert.match(feed, /fuseThis\(post\.text\)/);
  assert.equal(page.includes("EditProfile"), false);
  assert.match(header, /<ProfileMenu/);
  assert.match(menu, /<EditProfile/);
  assert.match(menu, /Edit Profile/);
});

test("runtime profile files do not hardcode local nicknames or seed records", () => {
  const files = [
    "src/components/EditProfile.tsx",
    "src/components/ProfileMenu.tsx",
    "src/components/FeedPosts.tsx",
    "src/components/SiteHeader.tsx",
    "src/lib/profile-update.ts",
    "src/app/trending/page.tsx",
    "src/app/api/social/profile/route.ts",
  ];
  for (const rel of files) {
    const text = src(rel);
    assert.doesNotMatch(text, /\bIan\b/);
    assert.doesNotMatch(text, /\bbugs\b/i);
  }
  const card = readFileSync(join(root, "../../packages/ui/src/PostCard.tsx"), "utf8");
  const schema = readFileSync(join(root, "../../packages/database/schema.sql"), "utf8");
  assert.doesNotMatch(card, /\bIan\b|\bbugs\b/i);
  assert.equal(/INSERT\s+INTO\s+fused_profiles/i.test(schema), false);
});

test("a wallet signature binds address, name, pfp, and nonce; a different wallet is rejected", async () => {
  const account = privateKeyToAccount(generatePrivateKey());
  const other = privateKeyToAccount(generatePrivateKey());
  const message = fusedProfileUpdateMessage({
    address: getAddress(account.address),
    displayName: "Ada",
    pfpUrl: "https://cdn.example/ada.png",
    nonce: 0,
  });
  const signature = await account.signMessage({ message });
  assert.equal(
    await verifyMessage({ address: account.address, message, signature }),
    true,
  );
  assert.equal(
    await verifyMessage({ address: other.address, message, signature }),
    false,
  );
  const tampered = fusedProfileUpdateMessage({
    address: getAddress(account.address),
    displayName: "Not Ada",
    pfpUrl: "https://cdn.example/ada.png",
    nonce: 0,
  });
  assert.equal(
    await verifyMessage({ address: account.address, message: tampered, signature }),
    false,
  );
});

test("signed profile route verifies the wallet and rejects replay when the database is available", async (t) => {
  loadRepoEnv();
  const env = loadEnv();
  if (!env.databaseUrl) {
    t.skip("DATABASE_URL not configured");
    return;
  }
  const { createDatabaseClient } = await import("@fused-ai/database");
  const db = createDatabaseClient(env);
  const migrated = await db.migrate();
  await db.close();
  if (!migrated.ok) {
    t.skip("database unavailable");
    return;
  }
  const { applySignedFusedProfile, readFusedProfile } = await import("../src/lib/profile-update.ts");
  const account = privateKeyToAccount(generatePrivateKey());
  const other = privateKeyToAccount(generatePrivateKey());
  const address = getAddress(account.address);

  const missing = await readFusedProfile(address, env);
  if (missing.status === 503) {
    t.skip("database unavailable");
    return;
  }
  assert.equal(missing.status, 200);
  assert.equal(missing.body.nonce, 0);

  const message = fusedProfileUpdateMessage({
    address,
    displayName: "Ada",
    pfpUrl: "https://cdn.example/ada.png",
    nonce: 0,
  });
  const signature = await account.signMessage({ message });
  const saved = await applySignedFusedProfile(
    {
      address,
      displayName: "Ada",
      pfpUrl: "https://cdn.example/ada.png",
      nonce: 0,
      signature,
    },
    env,
  );
  assert.equal(saved.status, 200);
  assert.equal(saved.body.ok, true);
  assert.equal(saved.body.displayName, "Ada");
  assert.equal(saved.body.nonce, 1);

  const replay = await applySignedFusedProfile(
    {
      address,
      displayName: "Ada",
      pfpUrl: "https://cdn.example/ada.png",
      nonce: 0,
      signature,
    },
    env,
  );
  assert.equal(replay.status, 409);

  const wrongWallet = await applySignedFusedProfile(
    {
      address: getAddress(other.address),
      displayName: "Ada",
      pfpUrl: "https://cdn.example/ada.png",
      nonce: 0,
      signature,
    },
    env,
  );
  assert.equal(wrongWallet.status, 401);

  const unsigned = await applySignedFusedProfile(
    {
      address,
      displayName: "Hacked",
      pfpUrl: "https://cdn.example/ada.png",
      nonce: 1,
    },
    env,
  );
  assert.equal(unsigned.status, 400);

  const retained = await readFusedProfile(address, env);
  assert.equal(retained.status, 200);
  assert.equal(retained.body.displayName, "Ada");
  assert.equal(retained.body.nonce, 1);
});
