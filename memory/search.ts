import type { MemoryItem, MemoryStore } from "../types";
import { activeDomainId, matchProject } from "./scope";
import { looksLikeCodeLine } from "./derive";
import { projectKeyOf } from "./scope";

function normalizeText(t: string) {
  return (t || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function intentKey(it: any) {
  const cat = String(it?.meta?.playbookCategory || "").toLowerCase();
  let t = normalizeText(String(it?.text || ""));
  t = t
    .replace(/\b(decision|rationale|alternatives|preference|rule|standard)\b/g, " ")
    .replace(/\b(please|always|never|do not|dont|don't|must|should)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = t.split(" ").filter((x) => x.length > 2).slice(0, 14);
  const scoped = [cat || it.kind || "", ...tokens].join("|");
  return scoped;
}

function tokenSet(t: string) {
  return new Set(normalizeText(t).split(" ").filter((x) => x.length > 2));
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

function qualityFor(item: Partial<MemoryItem>) {
  const conf = Math.max(0, Math.min(1, Number(item.confidence || 0)));
  const seen = Number(item.seenCount || 0);
  const pinned = item.pinned ? 0.2 : 0;
  const len = (item.text || "").length;
  const lengthBonus = len > 42 ? 0.08 : 0;
  return Math.max(0, Math.min(1, conf * 0.72 + Math.min(0.2, Math.log1p(seen) * 0.07) + pinned + lengthBonus));
}

function extractFileRefs(text: string) {
  return Array.from(new Set((text.match(/[~./\w-]+\.(?:ts|tsx|js|jsx|json|md|py|go|cs|java|kt|rs|sql|yaml|yml)/gi) || []).map((x) => x.toLowerCase())));
}

function extractSymbolRefs(text: string) {
  const syms = new Set<string>();
  const m1 = text.matchAll(/\b([A-Z][A-Za-z0-9_]{2,})\b/g);
  for (const m of m1) if (m?.[1]) syms.add(m[1]);
  const m2 = text.matchAll(/\b([a-z][A-Za-z0-9_]{2,})\s*\(/g);
  for (const m of m2) if (m?.[1]) syms.add(m[1]);
  return Array.from(syms);
}

function attachLinks(it: any) {
  const links = Array.isArray((it.meta as any)?.links) ? ([...(it.meta as any).links] as any[]) : [];
  const files = extractFileRefs(String(it.text || ""));
  for (const file of files) links.push({ file });
  for (const s of extractSymbolRefs(String(it.text || ""))) links.push({ symbol: s });
  if ((it.meta as any)?.filePath) links.push({ file: String((it.meta as any).filePath).toLowerCase() });
  if (links.length) it.meta = { ...(it.meta || {}), links: Array.from(new Map(links.map((l: any) => [`${l.file || ""}::${l.symbol || ""}::${l.module || ""}`, l])).values()) };
}

function isDecisionOrRule(it: any) {
  const cat = String(it?.meta?.playbookCategory || "").toLowerCase();
  const txt = String(it?.text || "").toLowerCase();
  return cat === "decision" || cat === "code-rule" || /\b(decision|decided|must|always|never|do not|don't)\b/.test(txt);
}

function hasNegation(t: string) {
  return /\b(no|not|never|avoid|dont|don't|do not|without|forbid|forbidden|ban|banned)\b/.test(t);
}

function detectConflicts(scopeMatches: any[], it: any) {
  if (!isDecisionOrRule(it)) return [] as any[];
  const a = tokenSet(it.text || "");
  const aNeg = hasNegation(normalizeText(it.text || ""));
  const out: any[] = [];
  for (const x of scopeMatches) {
    if (!isDecisionOrRule(x)) continue;
    const b = tokenSet(x.text || "");
    const sim = jaccard(a, b);
    if (sim < 0.45) continue;
    const bNeg = hasNegation(normalizeText(x.text || ""));
    if (aNeg !== bNeg) out.push({ id: x.id, sim: Number(sim.toFixed(2)) });
  }
  return out.slice(0, 8);
}

export function upsertItems(store: MemoryStore, items: any[]) {
  const now = Date.now();
  for (const it of items) {
    const normalized = normalizeText(it.text || "");
    const scopeMatches = store.items.filter((x) => x.scope === it.scope && x.projectKey === it.projectKey && x.domainId === it.domainId);
    const exact = scopeMatches.find((x) => x.kind === it.kind && normalizeText(x.text) === normalized);
    if (exact) {
      exact.confidence = Math.max(exact.confidence, it.confidence || 0);
      exact.qualityScore = Math.max(Number(exact.qualityScore || 0), qualityFor({ ...exact, confidence: exact.confidence }));
      const cat = String((exact.meta as any)?.playbookCategory || "");
      if (cat) exact.meta = { ...(exact.meta || {}), confirmations: Number((exact.meta as any)?.confirmations || 1) + 1 };
      exact.updatedAt = now;
      continue;
    }

    const newSet = tokenSet(it.text || "");
    let best: any = null;
    let bestScore = 0;
    for (const x of scopeMatches) {
      if (x.kind !== it.kind) continue;
      const sim = jaccard(newSet, tokenSet(x.text || ""));
      if (sim > bestScore) { bestScore = sim; best = x; }
    }

    const ik = intentKey(it);
    const intentMatch = scopeMatches.find((x) => intentKey(x) === ik && (x.kind === it.kind || String((x.meta as any)?.playbookCategory || "") === String((it.meta as any)?.playbookCategory || "")));

    if ((best && bestScore >= 0.82) || intentMatch) {
      const target = intentMatch || best;
      target.confidence = Math.max(target.confidence, it.confidence || 0);
      target.qualityScore = Math.max(Number(target.qualityScore || 0), qualityFor({ ...target, confidence: target.confidence }));
      const cat = String((target.meta as any)?.playbookCategory || "");
      target.updatedAt = now;
      target.meta = { ...(target.meta || {}), mergedIds: Array.from(new Set([...(Array.isArray((target.meta as any)?.mergedIds) ? (target.meta as any).mergedIds : []), it.id])), ...(cat ? { confirmations: Number((target.meta as any)?.confirmations || 1) + 1 } : {}) };
      continue;
    }

    attachLinks(it);
    it.qualityScore = qualityFor(it);
    const conflicts = detectConflicts(scopeMatches, it);
    if (conflicts.length) {
      it.meta = { ...(it.meta || {}), conflictWith: conflicts.map((c: any) => c.id), conflictDetectedAt: now };
      store.items.push(it);
      store.items.push({
        id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
        kind: "lesson",
        scope: it.scope,
        projectKey: it.projectKey,
        domainId: it.domainId,
        text: `Potential conflict detected for '${normalizeText(it.text || "").slice(0, 80)}' with memories: ${conflicts.map((c: any) => `${c.id}(sim:${c.sim})`).join(", ")}`,
        confidence: 0.79,
        qualityScore: 0.75,
        source: "memory_conflict",
        createdAt: now,
        updatedAt: now,
        meta: { conflictFor: it.id, conflictWith: conflicts.map((c: any) => c.id) },
      } as any);
      continue;
    }
    store.items.push(it);
  }
}

export function searchMemory(store: MemoryStore, q: string, cwd: string) {
  const qq = (q || "").toLowerCase().trim();
  const words = qq.split(/\W+/).filter(Boolean);
  const qFiles = extractFileRefs(qq);
  const qSyms = extractSymbolRefs(q);
  const now = Date.now();
  return store.items
    .filter((x) => matchProject(store, x, cwd))
    .map((x) => {
      let score = x.confidence;
      score += Math.max(0, Math.min(1, Number(x.qualityScore || 0))) * 0.6;
      if (x.pinned) score += 0.8;
      const ageDays = Math.max(0, (now - (x.updatedAt || now)) / (1000 * 60 * 60 * 24));
      score += Math.max(0, 0.35 - ageDays * 0.02);
      if (!qq) score += 0.001;
      for (const w of words) if (x.text.toLowerCase().includes(w)) score += 0.2;

      const links = Array.isArray((x.meta as any)?.links) ? ((x.meta as any).links as any[]) : [];
      const linkFiles = new Set(links.map((l: any) => String(l?.file || "").toLowerCase()).filter(Boolean));
      const linkSyms = new Set(links.map((l: any) => String(l?.symbol || "")).filter(Boolean));
      if ((x.meta as any)?.filePath) linkFiles.add(String((x.meta as any).filePath).toLowerCase());

      for (const f of qFiles) if (linkFiles.has(f) || x.text.toLowerCase().includes(f)) score += 0.55;
      for (const s of qSyms) if (linkSyms.has(s) || x.text.includes(s)) score += 0.35;

      return { x, score };
    })
    .sort((a, b) => b.score - a.score || b.x.updatedAt - a.x.updatedAt)
    .map((s) => s.x);
}

export function relevantForPrompt(store: MemoryStore, prompt: string, cwd: string) {
  const picked = searchMemory(store, prompt, cwd).filter((m) => !looksLikeCodeLine(m.text)).slice(0, 12);
  const now = Date.now();
  for (const m of picked) {
    m.seenCount = (m.seenCount || 0) + 1;
    m.lastSeenAt = now;
  }
  return picked;
}

export function buildMemoryIndexBlock(store: MemoryStore, prompt: string, cwd: string) {
  const items = relevantForPrompt(store, prompt, cwd);
  if (!items.length) return "";
  const lines = items.map((m, i) => {
    const approx = Math.max(20, Math.ceil((m.text.length || 0) / 4));
    return `${i + 1}. (${m.id}) [${m.kind}] ~${approx}tok ${m.text}`;
  });
  return ["<memory_index>", ...lines, "</memory_index>", "Use /memory.timeline <id> for local chronology around an observation."].join("\n");
}

export function filterMemories(store: MemoryStore, q: string, cwd: string, projectKey?: string, domainId?: string) {
  const qq = (q || "").toLowerCase().trim();
  const did = (domainId || "").toLowerCase().trim();
  const pid = (projectKey || "").toLowerCase().trim();
  return store.items
    .filter((x) => {
      if (pid === "*") return true;
      if (pid) {
        const pDomain = activeDomainId(store, pid);
        return x.scope === "global" || x.projectKey === pid || (x.scope === "domain" && !!x.domainId && x.domainId === pDomain);
      }
      if (did && did !== "*") return x.scope === "global" || (x.scope === "domain" && x.domainId === did);
      return matchProject(store, x, cwd);
    })
    .filter((x) => !qq || x.text.toLowerCase().includes(qq) || x.kind.includes(qq))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 200);
}

export function filterObservations(store: MemoryStore, q: string, cwd: string, projectKey?: string) {
  const qq = (q || "").toLowerCase().trim();
  const pid = (projectKey || "").toLowerCase().trim() || projectKeyOf(cwd);
  return store.observations
    .filter((o) => pid === "*" ? true : o.projectKey === pid)
    .filter((o) => !qq || o.content.toLowerCase().includes(qq) || o.title.toLowerCase().includes(qq) || String((o.meta as any)?.obsKind || "").toLowerCase().includes(qq))
    .sort((a, b) => b.at - a.at)
    .slice(0, 200);
}
