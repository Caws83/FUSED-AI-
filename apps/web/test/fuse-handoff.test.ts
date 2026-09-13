import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { FUSE_HANDOFF_KEY, takeFuseHandoff, writeFuseHandoff } from "../src/lib/fuse-handoff.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

test("empty homepage input does not write a handoff", () => {
  const store = new MemoryStorage();
  assert.equal(writeFuseHandoff("short", store), false);
  assert.equal(writeFuseHandoff("   ", store), false);
  assert.equal(store.getItem(FUSE_HANDOFF_KEY), null);
});

test("handoff text can be taken exactly once", () => {
  const store = new MemoryStorage();
  const text = "We just launched a lime lightning club for builders.";
  assert.equal(writeFuseHandoff(text, store), true);
  assert.equal(takeFuseHandoff(store), text);
  assert.equal(takeFuseHandoff(store), null);
  assert.equal(store.getItem(FUSE_HANDOFF_KEY), null);
});

test("refresh after consume cannot re-run generation", () => {
  const store = new MemoryStorage();
  writeFuseHandoff("A perfectly normal social post about coffee.", store);
  assert.ok(takeFuseHandoff(store));
  assert.equal(takeFuseHandoff(store), null);
});

test("missing sessionStorage does not throw on the server", () => {
  assert.equal(takeFuseHandoff(), null);
  assert.equal(writeFuseHandoff("A perfectly normal social post about coffee."), false);
});

test("back or forward after consume cannot take the same payload", () => {
  const store = new MemoryStorage();
  writeFuseHandoff("A perfectly normal social post about coffee.", store);
  assert.ok(takeFuseHandoff(store));
  assert.equal(store.getItem(FUSE_HANDOFF_KEY), null);
  assert.equal(takeFuseHandoff(store), null);
});

test("malformed handoff is cleared and ignored", () => {
  const store = new MemoryStorage();
  store.setItem(FUSE_HANDOFF_KEY, "{not-json");
  assert.equal(takeFuseHandoff(store), null);
  assert.equal(store.getItem(FUSE_HANDOFF_KEY), null);
});

test("homepage FUSE IT hands text to /launch and does not call AI itself", () => {
  const home = readFileSync(join(root, "src/app/page.tsx"), "utf8");
  const quick = readFileSync(join(root, "src/components/QuickFuse.tsx"), "utf8");
  assert.match(home, /<QuickFuse/);
  assert.equal(home.includes("ready={"), false);
  assert.match(quick, /writeFuseHandoff/);
  assert.match(quick, /router\.push\("\/launch"\)/);
  assert.match(quick, /Paste a post with at least 8 characters/);
  assert.match(quick, /textarea/);
  assert.equal(quick.includes("/api/ai/fuse"), false);
  assert.equal(quick.includes("/api/social/fuse"), false);
  assert.equal(quick.includes("parseXPostUrl"), false);
  assert.equal(quick.includes("localStorage"), false);
});

test("FusePost consumes a handoff once and reuses /api/ai/fuse", () => {
  const fuse = readFileSync(join(root, "src/components/FusePost.tsx"), "utf8");
  assert.match(fuse, /takeFuseHandoff/);
  assert.match(fuse, /setText\(handed\)/);
  assert.match(fuse, /fuseWithText\(handed\)/);
  assert.match(fuse, /fusingRef/);
  assert.match(fuse, /\/api\/ai\/fuse/);
  assert.match(fuse, /useState\(""\)/);
  assert.equal(/takeFuseHandoff\(\)/.test(fuse.replace(/useEffect\(\(\) => \{[\s\S]*?\}, \[\]\);/, "")), false);
  assert.equal(fuse.includes("writeContract"), false);
});

test("normal /launch visit has no automatic fuse trigger in the page", () => {
  const page = readFileSync(join(root, "src/app/launch/page.tsx"), "utf8");
  const manual = readFileSync(join(root, "src/components/ManualLaunch.tsx"), "utf8");
  assert.equal(page.includes("takeFuseHandoff"), false);
  assert.equal(page.includes("writeFuseHandoff"), false);
  assert.match(manual, /FusePost/);
  assert.match(manual, /\/api\/media\/upload/);
});
