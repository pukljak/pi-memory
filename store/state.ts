import type { MemoryStore } from "../types";
import { projectKeyOf } from "../memory/scope";

export function stats(store: MemoryStore, cwd: string) {
  const k = projectKeyOf(cwd);
  const projectItems = store.items.filter((x) => x.projectKey === k).length;
  const lessons = store.items.filter((x) => x.kind === "lesson" && (x.scope === "global" || x.projectKey === k)).length;
  const obs = store.observations.filter((o) => o.projectKey === k).length;
  return { totalItems: store.items.length, projectItems, lessons, observations: obs };
}

export function listProjects(store: MemoryStore) {
  const s = new Set<string>();
  for (const i of store.items) if (i.projectKey) s.add(i.projectKey);
  for (const o of store.observations) if (o.projectKey) s.add(o.projectKey);
  return Array.from(s).sort();
}

export function listDomains(store: MemoryStore) {
  const s = new Set<string>(Object.keys(store.domains || {}));
  for (const i of store.items) if (i.domainId) s.add(i.domainId);
  return Array.from(s).sort();
}
