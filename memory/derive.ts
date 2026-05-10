import type { MemoryItem } from "../types";

export const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function summarize(text: string, max = 280) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

export function looksLikeCodeLine(s: string) {
  const t = s.trim();
  if (!t) return false;
  return /[{};]|=>|\b(const|let|var|function|type|interface|class|return|if\s*\()/i.test(t);
}

export function deriveMemories(raw: string, projectKey: string): MemoryItem[] {
  const lines = raw.split(/\r?\n/).map((x) => x.trim()).filter(Boolean).slice(0, 240);
  const now = Date.now();
  const items: MemoryItem[] = [];
  for (const line of lines) {
    const l = line.toLowerCase();
    if (l.length < 12 || looksLikeCodeLine(line)) continue;
    if (l.includes("prefer") || l.includes("please use") || l.includes("always use")) items.push({ id: uid(), kind: "preference", scope: "project", projectKey, text: line, confidence: 0.86, source: "agent_end", createdAt: now, updatedAt: now });
    else if (l.includes("don't") || l.includes("do not") || l.includes("instead") || l.includes("never")) items.push({ id: uid(), kind: "lesson", scope: "project", projectKey, text: line, confidence: 0.84, source: "agent_end", createdAt: now, updatedAt: now });
    else if (l.includes("architecture") || l.includes("pattern") || l.includes("convention") || l.includes("we use")) items.push({ id: uid(), kind: "pattern", scope: "project", projectKey, text: line, confidence: 0.8, source: "agent_end", createdAt: now, updatedAt: now });
  }
  return items;
}
