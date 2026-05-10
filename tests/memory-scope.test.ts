import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { activeDomainId, bindDomainRoot, rootForCwd } from "../memory/scope";
import { emptyStore } from "../store/file-store";

describe("memory scope", () => {
  it("picks longest matching domain root", () => {
    const store = emptyStore();
    bindDomainRoot(store, "mono", "/repo");
    bindDomainRoot(store, "svc-a", "/repo/services/a");

    const id = activeDomainId(store, "/repo/services/a/src");
    assert.equal(id, "svc-a");
  });

  it("returns matched root metadata", () => {
    const store = emptyStore();
    bindDomainRoot(store, "svc-a", "/repo/services/a");
    const info = rootForCwd(store, "/repo/services/a/src/foo.ts");
    assert.equal(info.domainId, "svc-a");
    assert.equal(info.root, "/repo/services/a");
  });
});
