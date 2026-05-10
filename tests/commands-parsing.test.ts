import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { registerCommands } from "../commands/register";
import { createHarness } from "./command-harness";

let h: ReturnType<typeof createHarness>;

beforeEach(() => {
  h = createHarness();
  registerCommands(h.pi, h.deps);
});

describe("command parsing", () => {
  it("memory.search requires query", async () => {
    await h.commands.get("memory.search").handler("", h.ctx);
    assert.equal(h.notifications.at(-1)?.level, "error");
    assert.match(h.notifications.at(-1)?.message || "", /Usage: \/memory\.search/);
  });

  it("memory.rule requires add syntax", async () => {
    await h.commands.get("memory.rule").handler("oops", h.ctx);
    assert.equal(h.notifications.at(-1)?.level, "error");
  });

  it("memory.ui command is registered", async () => {
    assert.ok(h.commands.get("memory.ui"));
  });

  it("memory.forget removes by text", async () => {
    h.store.items.push({ id: "1", kind: "fact", scope: "project", projectKey: "/repo", text: "remove me", confidence: 0.8, source: "t", createdAt: Date.now(), updatedAt: Date.now() });
    await h.commands.get("memory.forget").handler("remove me", h.ctx);
    assert.equal(h.store.items.length, 0);
  });

  it("memory.playbook command is registered", async () => {
    assert.ok(h.commands.get("memory.playbook"));
  });
});
