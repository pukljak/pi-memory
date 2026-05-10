import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { timeline } from "../observations/timeline";
import type { MemoryStore } from "../types";

function mkStore(): MemoryStore {
  return { version: 3, items: [], observations: [], domains: {} };
}

describe("observation timeline", () => {
  it("returns centered window around anchor", () => {
    const store = mkStore();
    const key = "/repo";
    for (let i = 0; i < 8; i++) {
      store.observations.push({ id: `o${i}`, sessionId: "s1", projectKey: key, at: 1000 + i, type: "tool", title: "t", content: `c${i}` });
    }
    const out = timeline(store, "o4", key, 2, 2);
    assert.deepEqual(out.map((x) => x.id), ["o2", "o3", "o4", "o5", "o6"]);
  });

  it("returns empty when anchor missing", () => {
    const store = mkStore();
    const out = timeline(store, "missing", "/repo", 2, 2);
    assert.deepEqual(out, []);
  });
});
