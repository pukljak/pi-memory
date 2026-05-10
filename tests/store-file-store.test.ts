import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { emptyStore, loadStore, saveStore } from "../store/file-store";

describe("file store", () => {
  it("returns empty store when file missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pi-memory-test-"));
    const path = join(dir, "memory.json");
    const store = await loadStore(path);
    assert.deepEqual(store, emptyStore());
  });

  it("falls back to empty store on invalid json", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pi-memory-test-"));
    const path = join(dir, "memory.json");
    await writeFile(path, "{broken", "utf8");
    const store = await loadStore(path);
    assert.deepEqual(store, emptyStore());
  });

  it("round-trips persisted store", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pi-memory-test-"));
    const path = join(dir, "memory.json");
    const input = emptyStore();
    input.items.push({ id: "1", kind: "fact", scope: "project", projectKey: "/repo", text: "hello", confidence: 0.9, source: "t", createdAt: Date.now(), updatedAt: Date.now() });
    await saveStore(path, input);
    const out = await loadStore(path);
    assert.equal(out.items.length, 1);
    assert.equal(out.items[0].id, "1");
  });
});
