import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { LocalMediaStore } from "../src/local.ts";
import { validateImage } from "../src/validate.ts";

const PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

test("local store uploads, serves a relative URL, and deletes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fused-media-"));
  try {
    const store = new LocalMediaStore(root, "/api/media");
    const image = validateImage(PNG, "image/png");
    assert.equal(image.ok, true);
    if (!image.ok) return;
    const saved = await store.uploadTokenImage(image.value);
    assert.equal(saved.ok, true);
    if (!saved.ok) return;
    const url = store.getPublicUrl(saved.value.id);
    assert.equal(url, `/api/media/${saved.value.id}`);
    const read = await store.read(saved.value.id);
    assert.equal(read.ok, true);
    if (read.ok) assert.equal(read.value.mime, "image/png");
    const gone = await store.deleteTemporaryImage(saved.value.id);
    assert.equal(gone.ok, true);
    const missing = await store.read(saved.value.id);
    assert.equal(missing.ok, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("local store rejects path-traversal ids", async () => {
  const store = new LocalMediaStore("/tmp/fused-media-test", "/api/media");
  assert.equal(store.getPublicUrl("../secret.png"), null);
  assert.equal(store.getPublicUrl("..\\secret.png"), null);
  const read = await store.read("../../etc/passwd");
  assert.equal(read.ok, false);
});
