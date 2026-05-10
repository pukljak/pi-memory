import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { autoClassifyPlaybookItems } from "../memory/playbook";
import type { MemoryItem } from "../types";

function base(text: string, kind: MemoryItem["kind"] = "fact"): MemoryItem {
  const now = Date.now();
  return { id: `${now}`, kind, scope: "project", projectKey: "/repo", text, confidence: 0.8, source: "t", createdAt: now, updatedAt: now };
}

describe("playbook auto-classification", () => {
  it("classifies decision/rule/preference", () => {
    const items = [
      base("Decision: we chose Redis because read traffic is high", "lesson"),
      base("Never bypass validation in service layer", "lesson"),
      base("Prefer pnpm workspace install commands", "preference"),
    ];
    const tagged = autoClassifyPlaybookItems(items);
    assert.equal(tagged, 3);
    assert.equal((items[0].meta as any)?.playbookCategory, "decision");
    assert.equal((items[1].meta as any)?.playbookCategory, "code-rule");
    assert.equal((items[2].meta as any)?.playbookCategory, "preference");
    assert.equal(items[1].pinned, false);
  });

  it("pins rule/decision after confirmations reach threshold", () => {
    const item = base("Never bypass validation in service layer", "lesson");
    item.meta = { playbookCategory: "code-rule", confirmations: 3 };
    autoClassifyPlaybookItems([item], 3);
    assert.equal(item.pinned, true);
  });
});
