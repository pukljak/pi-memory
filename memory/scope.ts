import { resolve } from "node:path";
import type { MemoryStore, Scope } from "../types";

export const projectKeyOf = (cwd: string) => cwd.toLowerCase();

export function normalizePath(p: string) {
  return resolve(p).toLowerCase();
}

export function pathInside(child: string, root: string) {
  const c = normalizePath(child);
  const r = normalizePath(root);
  return c === r || c.startsWith(r.endsWith("/") ? r : `${r}/`);
}

export function activeDomainId(store: MemoryStore, cwd: string): string | undefined {
  let best: { id: string; len: number } | null = null;
  for (const [id, roots] of Object.entries(store.domains || {})) {
    for (const root of roots || []) {
      if (pathInside(cwd, root)) {
        const len = normalizePath(root).length;
        if (!best || len > best.len) best = { id, len };
      }
    }
  }
  return best?.id;
}

export function rootForCwd(store: MemoryStore, cwd: string): { domainId?: string; root?: string } {
  const domainId = activeDomainId(store, cwd);
  if (!domainId) return {};
  const roots = store.domains[domainId] || [];
  const root = roots.filter((r) => pathInside(cwd, r)).sort((a, b) => normalizePath(b).length - normalizePath(a).length)[0];
  return { domainId, root };
}

export function bindDomainRoot(store: MemoryStore, domainId: string, rootPath: string) {
  const key = domainId.trim().toLowerCase();
  if (!key) return;
  const root = resolve(rootPath);
  const arr = store.domains[key] || [];
  if (!arr.some((x) => normalizePath(x) === normalizePath(root))) arr.push(root);
  store.domains[key] = arr;
}

export function matchProject(store: MemoryStore, x: { scope?: Scope; projectKey?: string; domainId?: string }, cwd: string) {
  const key = projectKeyOf(cwd);
  if (x.scope === "global") return true;
  if (x.scope === "project") return x.projectKey === key;
  if (x.scope === "domain") return !!x.domainId && x.domainId === activeDomainId(store, cwd);
  return false;
}
