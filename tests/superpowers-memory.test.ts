import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeSuperpowersSuggestionScore, deriveSuperpowersMemories } from "../memory/superpowers";

describe("superpowers memory", () => {
  it("derives superpowers-tagged memories", () => {
    const raw = [
      "In superpowers brainstorming we decided to keep API first.",
      "This is important to user: keep responses short.",
    ].join("\n");
    const out = deriveSuperpowersMemories(raw, "/repo");
    assert.ok(out.length >= 1);
    assert.equal((out[0].meta as any)?.source, "superpowers");
  });

  it("boosts score for accepted suggestions and penalizes rejected", () => {
    const tokens = new Set(["superpowers", "decided", "api"]);
    const base = {
      id: "a",
      kind: "lesson" as const,
      scope: "project" as const,
      projectKey: "/repo",
      text: "superpowers decided api direction",
      confidence: 0.9,
      source: "agent_end:superpowers",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      meta: { source: "superpowers", suggestionShown: 5, suggestionAccepted: 4, suggestionRejected: 1 },
    };
    const bad = {
      ...base,
      id: "b",
      meta: { source: "superpowers", suggestionShown: 5, suggestionAccepted: 0, suggestionRejected: 5 },
    };
    const s1 = computeSuperpowersSuggestionScore(tokens, base as any);
    const s2 = computeSuperpowersSuggestionScore(tokens, bad as any);
    assert.ok(s1 > s2);
  });
});
