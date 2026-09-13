import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadEnv } from "@fused-ai/config";
import { LocalMediaStore } from "../src/local.ts";
import {
  aiImageRouteError,
  createAIImageProvider,
  generateAndStoreTokenLogo,
} from "../src/ai-image.ts";
import { validateImage } from "../src/validate.ts";

const PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);
const PNG_B64 = Buffer.from(PNG).toString("base64");

function configuredEnv() {
  return loadEnv({
    AI_IMAGE_PROVIDER: "openai",
    AI_IMAGE_API_KEY: "sk-test",
    AI_IMAGE_MODEL: "dall-e-3",
    AI_IMAGE_TIMEOUT_MS: "5000",
  });
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("unconfigured AI image provider fails closed", async () => {
  const provider = createAIImageProvider(loadEnv({}));
  const result = await provider.generateTokenImage({ name: "Fused", symbol: "FUSE" });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.status, "NOT_CONFIGURED");
    assert.equal(aiImageRouteError(result.error), "AI logo generation is not configured.");
  }
});

test("successful generation is stored through the media abstraction", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fused-ai-logo-"));
  const store = new LocalMediaStore(root, "https://pub-test.r2.dev");
  const result = await generateAndStoreTokenLogo(
    configuredEnv(),
    { name: "Fused", symbol: "FUSE", description: "A square mark", imagePrompt: "lime bolt" },
    {
      store,
      fetchImpl: async (_url, init) => {
        const payload = JSON.parse(String(init?.body)) as { prompt?: string; response_format?: string; size?: string };
        assert.match(payload.prompt ?? "", /Fused/);
        assert.match(payload.prompt ?? "", /FUSE/);
        assert.match(payload.prompt ?? "", /lime bolt/);
        assert.equal(payload.size, "1024x1024");
        assert.equal(payload.response_format, "b64_json");
        return jsonResponse({ data: [{ b64_json: PNG_B64 }] });
      },
    },
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.url, `https://pub-test.r2.dev/${result.value.id}`);
  const bytes = await readFile(path.join(root, result.value.id));
  const checked = validateImage(bytes, "image/png");
  assert.equal(checked.ok, true);
});

test("url-only provider responses fail closed and are not fetched", async () => {
  let fetchedExtra = false;
  const provider = createAIImageProvider(configuredEnv(), async (url) => {
    if (!url.endsWith("/images/generations")) fetchedExtra = true;
    return jsonResponse({ data: [{ url: "https://evil.example/logo.png" }] });
  });
  const result = await provider.generateTokenImage({ name: "Fused", symbol: "FUSE" });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.status, "PROVIDER_UNAVAILABLE");
    assert.match(result.error.reason, /b64_json/);
  }
  assert.equal(fetchedExtra, false);
});

test("invalid raster bytes from the provider fail closed", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fused-ai-logo-bad-"));
  const store = new LocalMediaStore(root, "https://pub-test.r2.dev");
  const svg = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>").toString("base64");
  const result = await generateAndStoreTokenLogo(
    configuredEnv(),
    { name: "Fused", symbol: "FUSE" },
    {
      store,
      fetchImpl: async () => jsonResponse({ data: [{ b64_json: svg }] }),
    },
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.status, "PROVIDER_UNAVAILABLE");
});

test("HTTP provider errors stay secret-safe", async () => {
  const provider = createAIImageProvider(configuredEnv(), async () => jsonResponse({ error: "nope" }, 401));
  const result = await provider.generateTokenImage({ name: "Fused", symbol: "FUSE" });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.status, "PROVIDER_UNAVAILABLE");
    assert.equal(result.error.reason.includes("sk-test"), false);
    assert.equal(aiImageRouteError(result.error).includes("sk-"), false);
  }
});

test("default image model is gpt-image-2 without dall-e response_format", async () => {
  const env = loadEnv({
    AI_IMAGE_PROVIDER: "openai",
    AI_IMAGE_API_KEY: "sk-test",
  });
  const captured: { body?: Record<string, unknown> } = {};
  const provider = createAIImageProvider(env, async (_url, init) => {
    captured.body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return jsonResponse({ data: [{ b64_json: PNG_B64 }] });
  });
  const result = await provider.generateTokenImage({ name: "Fused", symbol: "FUSE" });
  assert.equal(result.ok, true);
  assert.equal(captured.body?.model, "gpt-image-2");
  assert.equal(captured.body?.response_format, undefined);
  assert.equal(captured.body?.n, undefined);
});

test("newer image models omit dall-e response_format", async () => {
  const env = loadEnv({
    AI_IMAGE_PROVIDER: "openai",
    AI_IMAGE_API_KEY: "sk-test",
    AI_IMAGE_MODEL: "gpt-image-1",
  });
  const captured: { body?: Record<string, unknown> } = {};
  const provider = createAIImageProvider(env, async (_url, init) => {
    captured.body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return jsonResponse({ data: [{ b64_json: PNG_B64 }] });
  });
  const result = await provider.generateTokenImage({ name: "Fused", symbol: "FUSE" });
  assert.equal(result.ok, true);
  assert.equal(captured.body?.response_format, undefined);
  assert.equal(captured.body?.size, "1024x1024");
});

test("timeout is reported as a clean failure", async () => {
  const env = loadEnv({
    AI_IMAGE_PROVIDER: "openai",
    AI_IMAGE_API_KEY: "sk-test",
    AI_IMAGE_TIMEOUT_MS: "5",
  });
  const provider = createAIImageProvider(env, async (_url, init) => {
    const abort = () => {
      const aborted = new Error("aborted");
      aborted.name = "AbortError";
      throw aborted;
    };
    if (init?.signal?.aborted) abort();
    await new Promise<void>((_, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const aborted = new Error("aborted");
        aborted.name = "AbortError";
        reject(aborted);
      });
    });
    return jsonResponse({});
  });
  const result = await provider.generateTokenImage({ name: "Fused", symbol: "FUSE" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error.reason, /timed out/);
});
