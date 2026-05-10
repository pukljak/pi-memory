import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adaptMemoryScores } from "../memory/adaptive";
import type { MemoryStore } from "../types";

function mkStore(): MemoryStore {
  return { version: 3, items: [], observations: [], domains: {} };
}

describe("memory adaptive", () => {
  it("boosts confidence for accepted feedback", () => {
    const store = mkStore();
    store.items.push({
      id: "a", kind: "lesson", scope: "project", projectKey: "/repo", text: "x", confidence: 0.6, source: "t", createdAt: Date.now(), updatedAt: Date.now(),
      meta: { suggestionAccepted: 4, suggestionRejected: 0 }
    });
    adaptMemoryScores(store);
    assert.ok(Number(store.items[0].confidence) > 0.6);
  });

  it("suppresses stale repeatedly rejected items", () => {
    const store = mkStore();
    const old = Date.now() - 1000 * 60 * 60 * 24 * 80;
    store.items.push({
      id: "b", kind: "lesson", scope: "project", projectKey: "/repo", text: "y", confidence: 0.7, source: "t", createdAt: old, updatedAt: old,
      meta: { suggestionAccepted: 0, suggestionRejected: 4 }
    });
    adaptMemoryScores(store);
    assert.equal((store.items[0].meta as any).suppressed, true);
  });
});
