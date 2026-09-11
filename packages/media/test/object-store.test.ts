import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { loadEnv } from "@fused-ai/config";
import { objectPublicUrl, ObjectMediaStore } from "../src/object-store.ts";

test("object public URLs reject path traversal and require a base", () => {
  assert.equal(objectPublicUrl("https://cdn.example.com", "../secret.png"), null);
  assert.equal(objectPublicUrl("https://cdn.example.com", "not-hex.png"), null);
  assert.equal(objectPublicUrl(null, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png"), null);
  assert.equal(
    objectPublicUrl("https://cdn.example.com/", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png"),
    "https://cdn.example.com/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png",
  );
});

test("ObjectMediaStore is not configured without AWS credentials", () => {
  const store = new ObjectMediaStore(loadEnv({ MEDIA_STORE: "r2", NODE_ENV: "production" }));
  assert.equal(store.availability().status, "NOT_CONFIGURED");
  assert.equal(store.getPublicUrl("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png"), null);
});

test("ObjectMediaStore is ready when existing S3/R2 env names are set", () => {
  const env = loadEnv({
    NODE_ENV: "production",
    MEDIA_STORE: "r2",
    AWS_ACCESS_KEY_ID: "id",
    AWS_SECRET_ACCESS_KEY: "secret",
    BUCKET_NAME: "fused-media",
    IMAGE_PUBLIC_BASE: "https://cdn.example.com",
    AWS_ENDPOINT_URL_S3: "https://account.r2.cloudflarestorage.com",
    AWS_REGION: "auto",
  });
  const store = new ObjectMediaStore(env);
  assert.equal(store.id, "s3");
  assert.equal(store.availability().status, "OK");
  assert.equal(
    store.getPublicUrl("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png"),
    "https://cdn.example.com/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png",
  );
});

test("media factory keeps local Anvil on the filesystem and production on ObjectMediaStore", () => {
  const src = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "index.ts"), "utf8");
  assert.match(src, /kind === "s3" \|\| kind === "r2"/);
  assert.match(src, /new ObjectMediaStore\(env\)/);
  assert.match(src, /new LocalMediaStore/);
});
