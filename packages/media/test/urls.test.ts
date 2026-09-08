import assert from "node:assert/strict";
import test from "node:test";
import { assertPublicMediaUrl } from "../src/urls.ts";

test("local chain may use localhost or /api/media paths", () => {
  assert.equal(assertPublicMediaUrl("/api/media/abc.png", 31337).ok, true);
  assert.equal(assertPublicMediaUrl("http://127.0.0.1:3000/api/media/abc.png", 31337).ok, true);
});

test("public chains reject localhost, blob, data, and relative media URLs", () => {
  assert.equal(assertPublicMediaUrl("blob:https://x/1", 8453).ok, false);
  assert.equal(assertPublicMediaUrl("data:image/png;base64,xx", 8453).ok, false);
  assert.equal(assertPublicMediaUrl("http://localhost:3000/a.png", 8453).ok, false);
  assert.equal(assertPublicMediaUrl("/api/media/abc.png", 8453).ok, false);
  assert.equal(assertPublicMediaUrl("https://cdn.example.com/a.png", 8453).ok, true);
});
