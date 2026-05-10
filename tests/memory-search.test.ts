import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { searchMemory, upsertItems } from "../memory/search";
import type { MemoryStore } from "../types";

function mkStore(): MemoryStore {
  return { version: 3, items: [], observations: [], domains: { mono: ["/repo"] } };
}

describe("memory search", () => {
  it("prefers pinned memories", () => {
    const store = mkStore();
    const now = Date.now();
    store.items.push(
      { id: "a", kind: "fact", scope: "project", projectKey: "/repo", text: "use axios for api client", confidence: 0.8, source: "t", createdAt: now, updatedAt: now },
      { id: "b", kind: "fact", scope: "project", projectKey: "/repo", text: "use axios for api client", confidence: 0.8, source: "t", createdAt: now, updatedAt: now, pinned: true },
    );
    const res = searchMemory(store, "axios", "/repo");
    assert.equal(res[0]?.id, "b");
  });

  it("matches domain-scoped memory for child path", () => {
    const store = mkStore();
    const now = Date.now();
    store.items.push({ id: "d1", kind: "pattern", scope: "domain", domainId: "mono", text: "shared auth middleware", confidence: 0.9, source: "t", createdAt: now, updatedAt: now });
    const res = searchMemory(store, "auth middleware", "/repo/services/a");
    assert.equal(res[0]?.id, "d1");
  });

  it("boosts link/file matches", () => {
    const store = mkStore();
    const now = Date.now();
    store.items.push(
      { id: "x", kind: "fact", scope: "project", projectKey: "/repo", text: "api behavior details", confidence: 0.95, source: "t", createdAt: now, updatedAt: now },
      { id: "y", kind: "fact", scope: "project", projectKey: "/repo", text: "handler in src/api/user.ts", confidence: 0.7, source: "t", createdAt: now, updatedAt: now, meta: { links: [{ file: "src/api/user.ts" }] } },
    );
    const res = searchMemory(store, "check src/api/user.ts", "/repo");
    assert.equal(res[0]?.id, "y");
  });

  it("merges near duplicates on upsert", () => {
    const store = mkStore();
    const now = Date.now();
    store.items.push({ id: "base", kind: "preference", scope: "project", projectKey: "/repo", text: "Prefer pnpm for workspace installs", confidence: 0.7, source: "t", createdAt: now, updatedAt: now });
    upsertItems(store, [{ id: "n1", kind: "preference", scope: "project", projectKey: "/repo", text: "Prefer pnpm for workspace dependency installs", confidence: 0.9, source: "t", createdAt: now, updatedAt: now }]);
    assert.equal(store.items.length, 1);
    assert.ok(store.items[0].confidence >= 0.9);
  });

  it("increments confirmations when merging classified playbook item", () => {
    const store = mkStore();
    const now = Date.now();
    store.items.push({ id: "r1", kind: "lesson", scope: "project", projectKey: "/repo", text: "Never bypass validation in service layer", confidence: 0.8, source: "t", createdAt: now, updatedAt: now, meta: { playbookCategory: "code-rule", confirmations: 1 } });
    upsertItems(store, [{ id: "r2", kind: "lesson", scope: "project", projectKey: "/repo", text: "Never bypass validation in service layer", confidence: 0.85, source: "t", createdAt: now, updatedAt: now }]);
    assert.equal(Number((store.items[0].meta as any)?.confirmations), 2);
  });
});
