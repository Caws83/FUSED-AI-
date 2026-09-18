import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const PUBLIC_PAGES = [
  "src/app/page.tsx",
  "src/app/community/page.tsx",
  "src/app/launch/page.tsx",
  "src/app/rewards/page.tsx",
  "src/components/CreatorRewards.tsx",
  "src/app/explore/page.tsx",
  "src/app/roadmap/page.tsx",
  "src/app/docs/page.tsx",
  "src/components/SiteFooter.tsx",
  "src/app/token/[address]/page.tsx",
  "src/components/QuickFuse.tsx",
  "src/components/FeedComposer.tsx",
  "src/components/FeedPosts.tsx",
  "src/components/SiteHeader.tsx",
  "src/components/ManualLaunch.tsx",
  "src/components/FusePost.tsx",
  "src/components/TokenTerminal.tsx",
  "src/lib/boards.tsx",
];

const FORBIDDEN = [
  "provider not configured",
  "database unavailable",
  "RPC unavailable",
  "adapter unavailable",
  "indexer not configured",
  "contracts not deployed",
  "Wallet not configured",
  "when a provider exists",
  "DEX adapters from the registry",
  "verified assets not configured",
  "implemented = true",
  "available = false",
];

test("public routes do not contain developer configuration language", () => {
  for (const rel of PUBLIC_PAGES) {
    const text = readFileSync(join(root, rel), "utf8");
    for (const phrase of FORBIDDEN) {
      assert.equal(text.toLowerCase().includes(phrase.toLowerCase()), false, `${rel} contains "${phrase}"`);
    }
  }
});
