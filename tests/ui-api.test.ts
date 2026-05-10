import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { handleApi } from "../ui/api";
import { emptyStore } from "../store/file-store";

function deps() {
  const store = emptyStore();
  return {
    cwd: "/repo",
    listProjects: () => ["/repo"],
    listDomains: () => ["mono"],
    filterMemories: (_q: string) => store.items,
    filterObservations: (_q: string) => store.observations,
    timeline: () => [],
    stats: () => ({ totalItems: store.items.length }),
    getStore: () => store,
    persist: async () => {},
  } as any;
}

describe("ui api", () => {
  it("returns summary section payload", () => {
    const d = deps();
    const out = handleApi(new URL("http://x/api/summary?section=preferences&strict=1"), d) as any;
    assert.equal(out.section, "preferences");
    assert.ok(out.summary);
    assert.ok(out.evidence);
  });

  it("returns recall-pack for architecture", () => {
    const d = deps();
    const out = handleApi(new URL("http://x/api/recall-pack?name=architecture"), d) as any;
    assert.equal(out.name, "architecture");
    assert.ok(typeof out.brief === "string");
  });

  it("handles playbook preference confirm endpoint", () => {
    const d = deps();
    d.getStore().items.push({ id: "p1", kind: "preference", scope: "project", projectKey: "/repo", text: "prefer pnpm", confidence: 0.8, source: "t", createdAt: Date.now(), updatedAt: Date.now(), meta: { playbookCategory: "preference", confirmations: 2 } });
    const out = handleApi(new URL("http://x/api/memory/preference-confirm?id=p1"), d) as any;
    assert.equal(out.ok, true);
    assert.equal(out.promoted, true);
    assert.equal(d.getStore().items[0].pinned, true);
  });
});
