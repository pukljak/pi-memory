import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pruneMemories } from "../memory/retention";
import type { MemoryStore } from "../types";

function mkStore(items: MemoryStore["items"]): MemoryStore {
  return { version: 3, items, observations: [], domains: {} };
}

describe("prune policy", () => {
  it("protects decision and code-rule from prune", () => {
    const now = Date.now();
    const store = mkStore([
      { id: "d1", kind: "lesson", scope: "project", projectKey: "/repo", text: "Decision: use redis", confidence: 0.6, source: "t", createdAt: now - 200 * 86400000, updatedAt: now - 200 * 86400000, meta: { playbookCategory: "decision" } },
      { id: "r1", kind: "lesson", scope: "project", projectKey: "/repo", text: "Never bypass auth", confidence: 0.6, source: "t", createdAt: now - 200 * 86400000, updatedAt: now - 200 * 86400000, meta: { playbookCategory: "code-rule" } },
    ]);
    const report = pruneMemories(store, { now, dryRun: false, staleDays: 30, hardStaleDays: 60 });
    assert.equal(report.removed, 0);
    assert.equal(store.items.length, 2);
  });

  it("expires old session-brief", () => {
    const now = Date.now();
    const store = mkStore([
      { id: "s1", kind: "fact", scope: "project", projectKey: "/repo", text: "<session_brief>...", confidence: 0.8, source: "t", createdAt: now - 20 * 86400000, updatedAt: now - 20 * 86400000, meta: { playbookCategory: "session-brief" } },
    ]);
    const report = pruneMemories(store, { now, dryRun: false });
    assert.equal(report.removed, 1);
    assert.equal(store.items.length, 0);
  });
});
