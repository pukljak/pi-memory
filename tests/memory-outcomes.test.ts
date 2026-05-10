import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyOutcomeLearning } from "../memory/outcomes";
import type { MemoryStore } from "../types";

function mkStore(): MemoryStore {
  return { version: 3, items: [], observations: [], domains: {} };
}

describe("memory outcomes", () => {
  it("decreases confidence on failed tests for related memory", () => {
    const store = mkStore();
    const now = Date.now();
    store.items.push({
      id: "m1", kind: "lesson", scope: "project", projectKey: "/repo", text: "fix in src/api/user.ts", confidence: 0.8, qualityScore: 0.8, source: "x", createdAt: now, updatedAt: now,
      meta: { links: [{ file: "src/api/user.ts" }] },
    });
    store.observations.push({
      id: "o1", sessionId: "s1", projectKey: "/repo", at: now, type: "tool", title: "npm test", content: "FAIL 2 tests", meta: { referencedFiles: ["src/api/user.ts"] },
    });
    applyOutcomeLearning(store, "/repo", "s1");
    assert.ok(Number(store.items[0].confidence) < 0.8);
    assert.equal((store.items[0].meta as any).lastOutcome, "failed");
  });

  it("increases confidence on passed tests for related memory", () => {
    const store = mkStore();
    const now = Date.now();
    store.items.push({
      id: "m2", kind: "lesson", scope: "project", projectKey: "/repo", text: "touch src/core/a.ts", confidence: 0.7, qualityScore: 0.7, source: "x", createdAt: now, updatedAt: now,
      meta: { links: [{ file: "src/core/a.ts" }] },
    });
    store.observations.push({
      id: "o2", sessionId: "s2", projectKey: "/repo", at: now, type: "tool", title: "pnpm test", content: "all tests passed", meta: { referencedFiles: ["src/core/a.ts"] },
    });
    applyOutcomeLearning(store, "/repo", "s2");
    assert.ok(Number(store.items[0].confidence) > 0.7);
    assert.equal((store.items[0].meta as any).lastOutcome, "passed");
  });
});
