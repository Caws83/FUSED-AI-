import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { loadEnv } from "@fused-ai/config";
import { LocalMediaStore } from "@fused-ai/media";
import { runFusePost } from "../src/lib/fuse-post.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function configuredEnv() {
  return loadEnv({
    AI_PROVIDER: "openai",
    AI_API_KEY: "sk-test",
    AI_MODEL: "gpt-4.1-mini",
    AI_IMAGE_PROVIDER: "openai",
    AI_IMAGE_API_KEY: "sk-test",
    AI_IMAGE_MODEL: "gpt-image-2",
    MEDIA_STORE: "local",
  });
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("missing AI config returns a clean fuse error", async () => {
  const result = await runFusePost(loadEnv({}), "A perfectly normal social post about coffee.");
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error, "AI draft is not configured.");
    assert.equal(result.status, 503);
    assert.equal(result.error.includes("sk-"), false);
  }
});

test("successful fuse returns text and stores one logo", async () => {
  const storeRoot = await mkdtemp(path.join(os.tmpdir(), "fused-fuse-"));
  const store = new LocalMediaStore(storeRoot, "https://pub-test.r2.dev");
  let calls = 0;
  const result = await runFusePost(configuredEnv(), "We just launched a lime lightning club for builders.", {
    store,
    fetchImpl: async (url) => {
      calls += 1;
      if (url.includes("/chat/completions")) {
        return jsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  name: "Lime Club",
                  ticker: "LIME",
                  description: "A token for the lime lightning club.",
                  logoPrompt: "A lime lightning bolt on navy",
                }),
              },
            },
          ],
        });
      }
      if (url.includes("/images/generations")) {
        return jsonResponse({ data: [{ b64_json: PNG_B64 }] });
      }
      throw new Error(`unexpected url ${url}`);
    },
  });
  assert.equal(result.ok, true);
  assert.equal(calls, 2);
  if (!result.ok) return;
  assert.equal(result.draft.ticker, "LIME");
  assert.ok(result.image?.id);
  assert.equal(result.imageError, null);
});

test("image failure keeps the successful text draft", async () => {
  const storeRoot = await mkdtemp(path.join(os.tmpdir(), "fused-fuse-fail-"));
  const store = new LocalMediaStore(storeRoot, "https://pub-test.r2.dev");
  const result = await runFusePost(configuredEnv(), "We just launched a lime lightning club for builders.", {
    store,
    fetchImpl: async (url) => {
      if (url.includes("/chat/completions")) {
        return jsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  name: "Lime Club",
                  ticker: "LIME",
                  description: "A token for the lime lightning club.",
                  logoPrompt: "A lime lightning bolt on navy",
                }),
              },
            },
          ],
        });
      }
      return jsonResponse({ error: "nope" }, 500);
    },
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.draft.name, "Lime Club");
  assert.equal(result.image, null);
  assert.ok(result.imageError);
  assert.equal(result.imageError.includes("sk-"), false);
});

test("fuse route uses pasted text only and never fetches URLs or X", () => {
  const route = readFileSync(join(root, "src/app/api/ai/fuse/route.ts"), "utf8");
  const lib = readFileSync(join(root, "src/lib/fuse-post.ts"), "utf8");
  assert.match(route, /runFusePost/);
  assert.match(route, /body\.text/);
  assert.equal(route.includes("postId"), false);
  assert.equal(route.includes("parseXPostUrl"), false);
  assert.equal(route.includes("createDatabaseClient"), false);
  assert.equal(lib.includes("http.get"), false);
  assert.match(lib, /generateAndStoreTokenLogo/);
});

test("Fuse UI populates the form, locks double clicks, and stays mobile-safe", () => {
  const fuse = readFileSync(join(root, "src/components/FusePost.tsx"), "utf8");
  const manual = readFileSync(join(root, "src/components/ManualLaunch.tsx"), "utf8");
  const css = readFileSync(join(root, "../../packages/ui/src/styles.css"), "utf8");
  assert.match(fuse, /FUSE IT/);
  assert.match(fuse, /Fusing\.\.\./);
  assert.match(fuse, /if \(fusing \|\| disabled\) return/);
  assert.match(fuse, /\/api\/ai\/fuse/);
  assert.equal(fuse.includes("writeContract"), false);
  assert.match(manual, /applyFusedDraft/);
  assert.match(manual, /setName\(draft\.name\)/);
  assert.match(manual, /setLogoError/);
  assert.match(manual, /\/api\/media\/upload/);
  assert.match(css, /\.fused-fuse-panel/);
  assert.match(css, /\.fused-logo-preview/);
  assert.equal(css.includes(".fused-fuse-panel {"), true);
  assert.equal(/fused-fuse-panel[\s\S]{0,200}width:\s*720px/.test(css), false);
  assert.equal(/fused-logo-preview[\s\S]{0,120}width:\s*400px/.test(css), false);
});
