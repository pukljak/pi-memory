import type { MemoryItem, MemoryStore } from "../types";

export type PruneOptions = {
  now?: number;
  staleDays?: number;
  hardStaleDays?: number;
  minScore?: number;
  dryRun?: boolean;
  maxItems?: number;
};

export type PruneReport = {
  scanned: number;
  removed: number;
  kept: number;
  reasons: Record<string, number>;
  candidates: { id: string; score: number; reason: string }[];
};

function daysSince(ts: number | undefined, now: number) {
  if (!ts) return Number.POSITIVE_INFINITY;
  return Math.max(0, (now - ts) / 86400000);
}

export function importanceScore(m: MemoryItem, now = Date.now()) {
  const kindWeight: Record<string, number> = {
    fact: 0.46,
    pattern: 0.4,
    preference: 0.34,
    lesson: 0.28,
  };
  const category = String((m.meta as any)?.playbookCategory || "").toLowerCase();
  const conf = Math.max(0, Math.min(1, m.confidence || 0));
  const quality = Math.max(0, Math.min(1, Number(m.qualityScore || 0)));
  const ageDays = daysSince(m.updatedAt, now);
  const seenDays = daysSince(m.lastSeenAt, now);
  const seenCount = m.seenCount || 0;

  let score = 0;
  score += (kindWeight[m.kind] ?? 0.32);
  score += conf * 0.34;
  score += quality * 0.18;
  score += Math.min(0.24, Math.log1p(seenCount) * 0.09);
  score -= Math.min(0.38, ageDays * 0.0042);
  if (!m.lastSeenAt && ageDays > 20) score -= 0.12;
  if (seenDays > 45) score -= Math.min(0.22, (seenDays - 45) * 0.003);
  if (m.text.startsWith("Auto-summary cluster:")) score -= 0.08;
  if (m.source === "memory_remember") score += 0.06;
  if (category === "decision" || category === "code-rule") score += 0.22;
  if (category === "good-example" || category === "bad-example") score += 0.14;
  if (category === "session-brief") score -= 0.1;
  if (m.pinned) score += 1;
  return score;
}

export function pruneMemories(store: MemoryStore, opts: PruneOptions = {}): PruneReport {
  const now = opts.now ?? Date.now();
  const staleDays = opts.staleDays ?? 45;
  const hardStaleDays = opts.hardStaleDays ?? 120;
  const minScore = opts.minScore ?? 0.34;
  const maxItems = opts.maxItems ?? 1200;

  const reasons: Record<string, number> = {};
  const candidates: { id: string; score: number; reason: string }[] = [];

  for (const m of store.items) {
    const category = String((m.meta as any)?.playbookCategory || "").toLowerCase();
    if (m.pinned) continue;
    if (category === "decision" || category === "code-rule") continue;

    const score = importanceScore(m, now);
    const lastUseDays = daysSince(m.lastSeenAt || m.updatedAt, now);
    let reason = "";
    if (category === "session-brief" && lastUseDays > 14) reason = "session-brief-expired";
    else if (lastUseDays >= hardStaleDays) reason = "hard-stale";
    else if (lastUseDays >= staleDays && score < minScore) reason = "stale-low-score";
    else if ((m.seenCount || 0) === 0 && lastUseDays > 21 && score < 0.2) reason = "never-used-low-score";
    if (reason) {
      reasons[reason] = (reasons[reason] || 0) + 1;
      candidates.push({ id: m.id, score, reason });
    }
  }

  if (store.items.length > maxItems) {
    const overflow = store.items.length - maxItems;
    const overflowCandidates = store.items
      .filter((m) => !m.pinned)
      .map((m) => ({ id: m.id, score: importanceScore(m, now), reason: "capacity" }))
      .sort((a, b) => a.score - b.score)
      .slice(0, overflow);
    for (const c of overflowCandidates) {
      reasons[c.reason] = (reasons[c.reason] || 0) + 1;
      if (!candidates.find((x) => x.id === c.id)) candidates.push(c);
    }
  }

  const removeSet = new Set(candidates.map((c) => c.id));
  const scanned = store.items.length;
  let removed = 0;
  if (!opts.dryRun && removeSet.size) {
    const before = store.items.length;
    store.items = store.items.filter((m) => !removeSet.has(m.id));
    removed = before - store.items.length;
  }

  return {
    scanned,
    removed: opts.dryRun ? removeSet.size : removed,
    kept: opts.dryRun ? scanned - removeSet.size : store.items.length,
    reasons,
    candidates: candidates.sort((a, b) => a.score - b.score).slice(0, 80),
  };
}
