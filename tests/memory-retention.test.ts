import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pruneMemories } from "../memory/retention";
import type { MemoryStore } from "../types";

const now = Date.now();

function storeWith(items: MemoryStore["items"]): MemoryStore {
  return { version: 3, items, observations: [], domains: {} };
}

describe("memory retention", () => {
  it("does not prune pinned memories", () => {
    const store = storeWith([
      { id: "1", kind: "fact", scope: "project", projectKey: "p", text: "important", confidence: 0.8, source: "x", createdAt: now - 90 * 86400000, updatedAt: now - 90 * 86400000, pinned: true },
    ]);

    const report = pruneMemories(store, { now, dryRun: false, staleDays: 30, hardStaleDays: 60 });
    assert.equal(report.removed, 0);
    assert.equal(store.items.length, 1);
  });

  it("prunes stale low-score memories", () => {
    const store = storeWith([
      { id: "2", kind: "lesson", scope: "project", projectKey: "p", text: "old", confidence: 0.1, source: "x", createdAt: now - 120 * 86400000, updatedAt: now - 120 * 86400000, seenCount: 0 },
    ]);

    const report = pruneMemories(store, { now, dryRun: false, staleDays: 30, hardStaleDays: 60 });
    assert.equal(report.removed, 1);
    assert.equal(store.items.length, 0);
  });
});
