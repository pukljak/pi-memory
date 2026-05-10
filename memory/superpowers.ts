import type { MemoryItem } from "../types";
import { uid, summarize, looksLikeCodeLine } from "./derive";

export function computeSuperpowersSuggestionScore(queryTokens: Set<string>, item: MemoryItem) {
  const t = String(item.text || "").toLowerCase();
  const words = new Set(t.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 3));
  let overlap = 0;
  for (const w of queryTokens) if (words.has(w)) overlap++;
  const lexical = overlap / Math.max(1, Math.min(queryTokens.size, 12));

  const meta = (item.meta || {}) as any;
  const shown = Number(meta.suggestionShown || 0);
  const accepted = Number(meta.suggestionAccepted || 0);
  const rejected = Number(meta.suggestionRejected || 0);
  const feedbackTotal = Math.max(1, accepted + rejected);
  const acceptanceRate = accepted / feedbackTotal;
  const rejectionRate = rejected / feedbackTotal;
  const feedbackBoost = shown > 0 ? (acceptanceRate * 0.25) : 0;
  const feedbackPenalty = shown > 0 ? (rejectionRate * 0.25) : 0;

  return lexical + feedbackBoost - feedbackPenalty;
}

function inferType(line: string): "decision" | "preference" | "constraint" | "open-question" {
  const l = line.toLowerCase();
  if (/\b(decided|decision|chose|choose|trade[- ]?off|rationale)\b/.test(l)) return "decision";
  if (/\b(prefer|preference|important to user|style|convention)\b/.test(l)) return "preference";
  if (/\b(must|should|do not|don't|never|constraint|requirement)\b/.test(l)) return "constraint";
  return "open-question";
}

export function deriveSuperpowersMemories(raw: string, projectKey: string): MemoryItem[] {
  const now = Date.now();
  const lines = raw.split(/\r?\n/).map((x) => x.trim()).filter(Boolean).slice(0, 300);
  const items: MemoryItem[] = [];

  for (const line of lines) {
    const l = line.toLowerCase();
    if (line.length < 24 || looksLikeCodeLine(line)) continue;
    const isSuperpowersContext = /\b(superpowers|brainstorming|writing-plans|subagent-driven-development|executing-plans|docs\/superpowers\/)\b/.test(l);
    const looksMemoryWorthy = /\b(decided|decision|important|prefer|preference|must|should|never|do not|constraint|trade[- ]?off|rationale|asked|question)\b/.test(l);
    if (!isSuperpowersContext && !looksMemoryWorthy) continue;

    const spType = inferType(line);
    items.push({
      id: uid(),
      kind: spType === "preference" ? "preference" : spType === "open-question" ? "fact" : "lesson",
      scope: "project",
      projectKey,
      text: summarize(line, 320),
      confidence: isSuperpowersContext ? 0.84 : 0.74,
      source: "agent_end:superpowers",
      createdAt: now,
      updatedAt: now,
      meta: {
        source: "superpowers",
        superpowersType: spType,
        topic: "workflow-decisions",
      },
    });
  }

  return items;
}
