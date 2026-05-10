import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { upsertItems } from "../memory/search";
import type { MemoryStore } from "../types";

function mkStore(): MemoryStore {
  return { version: 3, items: [], observations: [], domains: {} };
}

describe("memory conflict detection", () => {
  it("adds conflict memory for opposite rule polarity", () => {
    const store = mkStore();
    const now = Date.now();
    store.items.push({
      id: "r1",
      kind: "lesson",
      scope: "project",
      projectKey: "/repo",
      text: "Always use axios for API calls",
      confidence: 0.9,
      source: "t",
      createdAt: now,
      updatedAt: now,
      meta: { playbookCategory: "code-rule" },
    });

    upsertItems(store, [{
      id: "r2",
      kind: "fact",
      scope: "project",
      projectKey: "/repo",
      text: "Never use axios for API calls",
      confidence: 0.9,
      source: "t",
      createdAt: now,
      updatedAt: now,
    }]);

    const conflict = store.items.find((x) => x.source === "memory_conflict");
    assert.ok(conflict);
  });
});
