import type { MemoryStore } from "../types";
import { projectKeyOf } from "../memory/scope";

export function searchObservations(store: MemoryStore, q: string, cwd: string, limit = 50) {
  const qq = (q || "").toLowerCase().trim();
  const key = projectKeyOf(cwd);
  return store.observations
    .filter((o) => o.projectKey === key && (!qq || o.content.toLowerCase().includes(qq) || o.title.toLowerCase().includes(qq)))
    .sort((a, b) => b.at - a.at)
    .slice(0, limit);
}

export function timeline(store: MemoryStore, anchorId: string, cwd: string, before = 5, after = 5) {
  const key = projectKeyOf(cwd);
  const all = store.observations.filter((o) => o.projectKey === key).sort((a, b) => a.at - b.at);
  const idx = all.findIndex((o) => o.id === anchorId);
  if (idx < 0) return [];
  return all.slice(Math.max(0, idx - before), Math.min(all.length, idx + after + 1));
}
