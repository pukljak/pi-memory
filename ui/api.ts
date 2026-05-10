import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

type UiDeps = {
  cwd: string;
  listProjects: () => string[];
  listDomains: () => string[];
  filterMemories: (q: string, cwd: string, projectKey?: string, domainId?: string) => any[];
  filterObservations: (q: string, cwd: string, projectKey?: string) => any[];
  timeline: (id: string, cwd: string, before?: number, after?: number) => any[];
  stats: (cwd: string) => any;
  getStore: () => any;
  persist: () => Promise<void>;
};

function uniq<T>(arr: T[]): T[] { return Array.from(new Set(arr)); }
function projectFilter(v: string | null) {
  const x = (v || "").toLowerCase().trim();
  if (x === "*") return "*";
  return !x ? undefined : x;
}
function domainFilter(v: string | null) {
  const x = (v || "").toLowerCase().trim();
  return !x || x === "*" ? undefined : x;
}

const summaryCache = new Map<string, { generatedAt: number; payload: any; feedback: { accurate: number; inaccurate: number } }>();
const SUMMARY_TTL_MS = 60_000;
const SUMMARY_CACHE_PATH = join(homedir(), ".pi", "pi-memory", "summary-cache.json");
const VIEWS_PATH = join(homedir(), ".pi", "pi-memory", "saved-views.json");
const SUMMARY_CACHE_MAX_ENTRIES = 200;
const SUMMARY_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;
let summaryCacheLoaded = false;

function cleanupSummaryCache() {
  const now = Date.now();
  const live = Array.from(summaryCache.entries())
    .filter(([, v]) => v && Number(v.generatedAt || 0) > 0)
    .filter(([, v]) => now - Number(v.generatedAt || 0) <= SUMMARY_CACHE_MAX_AGE_MS)
    .sort((a, b) => Number(b[1].generatedAt || 0) - Number(a[1].generatedAt || 0))
    .slice(0, SUMMARY_CACHE_MAX_ENTRIES);
  summaryCache.clear();
  for (const [k, v] of live) summaryCache.set(k, v);
}

function loadSummaryCacheFromDisk() {
  if (summaryCacheLoaded) return;
  summaryCacheLoaded = true;
  try {
    if (!existsSync(SUMMARY_CACHE_PATH)) return;
    const raw = readFileSync(SUMMARY_CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw || "{}");
    const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
    for (const e of entries) {
      if (!e || typeof e.key !== "string" || !e.value) continue;
      summaryCache.set(e.key, e.value);
    }
    cleanupSummaryCache();
  } catch {}
}

function saveSummaryCacheToDisk() {
  try {
    cleanupSummaryCache();
    mkdirSync(dirname(SUMMARY_CACHE_PATH), { recursive: true });
    const entries = Array.from(summaryCache.entries()).map(([key, value]) => ({ key, value }));
    writeFileSync(SUMMARY_CACHE_PATH, JSON.stringify({ version: 1, entries }, null, 2), "utf8");
  } catch {}
}

function defaultSavedViews() {
  return {
    "Architecture": { q: "", project: "*", domain: "*", playbookCategory: "decision", pageSize: "50", tab: "understanding", strictGrounded: true, updatedAt: Date.now() },
    "Recent changes": { q: "", project: "*", domain: "*", playbookCategory: "*", pageSize: "50", tab: "understanding", strictGrounded: true, updatedAt: Date.now() },
    "Team preferences": { q: "", project: "*", domain: "*", playbookCategory: "preference", pageSize: "50", tab: "understanding", strictGrounded: true, updatedAt: Date.now() },
  } as Record<string, any>;
}

function loadSavedViews(): Record<string, any> {
  try {
    if (!existsSync(VIEWS_PATH)) {
      const defs = defaultSavedViews();
      saveSavedViews(defs);
      return defs;
    }
    const raw = readFileSync(VIEWS_PATH, "utf8");
    const parsed = JSON.parse(raw || "{}");
    const views = parsed && typeof parsed === "object" ? parsed : {};
    const defs = defaultSavedViews();
    let changed = false;
    for (const k of Object.keys(defs)) {
      if (!views[k]) { views[k] = defs[k]; changed = true; }
    }
    if (changed) saveSavedViews(views);
    return views;
  } catch { return defaultSavedViews(); }
}

function saveSavedViews(views: Record<string, any>) {
  try {
    mkdirSync(dirname(VIEWS_PATH), { recursive: true });
    writeFileSync(VIEWS_PATH, JSON.stringify(views, null, 2), "utf8");
  } catch {}
}

function summarizeSection(section: string, memories: any[], observations: any[], strictGrounded = false) {
  const now = Date.now();
  const mem = Array.isArray(memories) ? memories : [];
  const obs = Array.isArray(observations) ? observations : [];
  const byFresh = [...mem].sort((a, b) => Number(b?.updatedAt || 0) - Number(a?.updatedAt || 0));
  const avgConf = mem.length ? mem.reduce((s, x) => s + Number(x?.confidence || 0), 0) / mem.length : 0;
  const lastAt = byFresh[0]?.updatedAt || 0;
  const ageDays = lastAt ? Math.floor((now - Number(lastAt)) / (1000 * 60 * 60 * 24)) : null;
  const staleCount = mem.filter((x) => now - Number(x?.updatedAt || 0) > 1000 * 60 * 60 * 24 * 30).length;

  const evidenceMemoryIds = byFresh.slice(0, 6).map((x) => String(x?.id || "")).filter(Boolean);
  const evidenceObservationIds = [...obs].sort((a, b) => Number(b?.at || 0) - Number(a?.at || 0)).slice(0, 4).map((x) => String(x?.id || "")).filter(Boolean);

  let whatIKnow = "I do not have enough grounded memory yet for this section.";
  let gaps = ["Add more explicit memories/decisions for this area."];

  if (section === "decisions") {
    const d = mem.filter((x) => String((x?.meta || {}).playbookCategory || "") === "decision");
    whatIKnow = d.length
      ? `I understand ${d.length} key decision(s). Most recent decisions emphasize: ${d.slice(0, 3).map((x) => String(x?.text || "").slice(0, 120)).join(" | ")}.`
      : "I have no explicit decision entries yet; architecture intent may be implicit only.";
    gaps = d.length ? ["Check if any decisions are outdated or conflicting."] : ["Capture decisions with rationale so future work is consistent."];
  } else if (section === "preferences") {
    const p = mem.filter((x) => String((x?.meta || {}).playbookCategory || "") === "preference" || x?.kind === "preference");
    whatIKnow = p.length
      ? `I understand ${p.length} preference(s) that guide implementation style. Repeated confirmations indicate stable team conventions.`
      : "I have little explicit preference data yet.";
    gaps = p.length ? ["Promote recurring preferences to standards/rules when stable."] : ["Record concrete preferences from feedback."];
  } else if (section === "codebase") {
    const links = uniq(mem.flatMap((x) => Array.isArray((x?.meta || {}).links) ? (x?.meta || {}).links : []).map((x: any) => String(x))).slice(0, 8);
    whatIKnow = mem.length
      ? `I understand parts of the codebase through stored facts/patterns. I can anchor answers to known files/symbols when links exist (${links.length} linked refs detected).`
      : "I do not yet have enough codebase memory.";
    gaps = links.length ? ["Expand coverage for unlinked modules."] : ["Run deeper explore/snapshot to attach file/symbol links."];
  } else {
    const kinds = uniq(obs.map((x) => String((x?.meta || {}).obsKind || "unknown"))).slice(0, 6);
    whatIKnow = obs.length
      ? `I understand recent work history from observations (${obs.length} events). Main activity kinds: ${kinds.join(", ") || "unknown"}.`
      : "No useful timeline observations found for this filter yet.";
    gaps = obs.length ? ["Keep capturing what-changed and decisions at task end."] : ["No timeline coverage; capture more observations."];
  }

  const strictFailed = strictGrounded && evidenceMemoryIds.length === 0 && evidenceObservationIds.length === 0;
  return {
    strictGrounded,
    section,
    summary: {
      whatIKnow,
      whyIBelieveIt: `Grounded in ${mem.length} memory item(s) and ${obs.length} observation(s) for current filter.`,
      confidence: mem.length ? (avgConf >= 0.8 ? "high" : avgConf >= 0.55 ? "medium" : "low") : "low",
      freshness: ageDays === null ? "unknown" : ageDays === 0 ? "updated today" : `${ageDays}d since last update`,
      gaps,
      staleCount,
    },
    evidence: {
      memoryIds: evidenceMemoryIds,
      observationIds: evidenceObservationIds,
    },
    strictFailed,
  };
}

export function handleApi(u: URL, deps: UiDeps) {
  loadSummaryCacheFromDisk();
  if (u.pathname === "/api/catalog") return { projects: deps.listProjects(), domains: deps.listDomains() };
  if (u.pathname === "/api/views") {
    const action = (u.searchParams.get("action") || "list").toLowerCase();
    const name = (u.searchParams.get("name") || "").trim();
    const views = loadSavedViews();
    if (action === "list") return { views };
    if (action === "save") {
      if (!name) return { ok: false, error: "missing name" };
      views[name] = {
        q: u.searchParams.get("q") || "",
        project: u.searchParams.get("project") || "*",
        domain: u.searchParams.get("domain") || "*",
        playbookCategory: u.searchParams.get("playbookCategory") || "*",
        pageSize: u.searchParams.get("pageSize") || "50",
        tab: u.searchParams.get("tab") || "main",
        strictGrounded: (u.searchParams.get("strict") || "0") === "1",
        updatedAt: Date.now(),
      };
      saveSavedViews(views);
      return { ok: true, views };
    }
    if (action === "delete") {
      if (!name) return { ok: false, error: "missing name" };
      delete views[name];
      saveSavedViews(views);
      return { ok: true, views };
    }
    return { ok: false, error: "unknown action" };
  }
  if (u.pathname === "/api/search") {
    const q = u.searchParams.get("q") || "";
    const project = projectFilter(u.searchParams.get("project"));
    const domain = domainFilter(u.searchParams.get("domain"));
    return { query: q, project: project || "*", domain: domain || "*", memories: deps.filterMemories(q, deps.cwd, project, domain), observations: deps.filterObservations(q, deps.cwd, project) };
  }
  if (u.pathname === "/api/timeline") {
    const id = u.searchParams.get("id") || "";
    const before = Number(u.searchParams.get("before") || 5);
    const after = Number(u.searchParams.get("after") || 5);
    return { id, timeline: deps.timeline(id, deps.cwd, before, after) };
  }
  if (u.pathname === "/api/stats") return deps.stats(deps.cwd);
  if (u.pathname === "/api/summary") {
    const section = (u.searchParams.get("section") || "timeline").toLowerCase();
    const q = u.searchParams.get("q") || "";
    const project = projectFilter(u.searchParams.get("project"));
    const domain = domainFilter(u.searchParams.get("domain"));
    const strictGrounded = (u.searchParams.get("strict") || "0") === "1";
    const force = (u.searchParams.get("force") || "0") === "1";
    const cacheKey = `one|${section}|${q}|${project || "*"}|${domain || "*"}|${strictGrounded ? 1 : 0}`;
    const cached = summaryCache.get(cacheKey);
    if (!force && cached && Date.now() - cached.generatedAt < SUMMARY_TTL_MS) return { ...cached.payload, generatedAt: cached.generatedAt, cached: true, feedback: cached.feedback };
    const memories = deps.filterMemories(q, deps.cwd, project, domain);
    const observations = deps.filterObservations(q, deps.cwd, project);
    const payload = summarizeSection(section, memories, observations, strictGrounded);
    const entry = { generatedAt: Date.now(), payload, feedback: cached?.feedback || { accurate: 0, inaccurate: 0 } };
    summaryCache.set(cacheKey, entry);
    saveSummaryCacheToDisk();
    return { ...payload, generatedAt: entry.generatedAt, cached: false, feedback: entry.feedback };
  }
  if (u.pathname === "/api/summary/all") {
    const q = u.searchParams.get("q") || "";
    const project = projectFilter(u.searchParams.get("project"));
    const domain = domainFilter(u.searchParams.get("domain"));
    const strictGrounded = (u.searchParams.get("strict") || "0") === "1";
    const force = (u.searchParams.get("force") || "0") === "1";
    const cacheKey = `all|${q}|${project || "*"}|${domain || "*"}|${strictGrounded ? 1 : 0}`;
    const cached = summaryCache.get(cacheKey);
    if (!force && cached && Date.now() - cached.generatedAt < SUMMARY_TTL_MS) return { ...cached.payload, generatedAt: cached.generatedAt, cached: true, feedback: cached.feedback };
    const memories = deps.filterMemories(q, deps.cwd, project, domain);
    const observations = deps.filterObservations(q, deps.cwd, project);
    const sections = ["decisions", "preferences", "codebase", "timeline"];
    const payload = { sections: sections.map((s) => summarizeSection(s, memories, observations, strictGrounded)) };
    const entry = { generatedAt: Date.now(), payload, feedback: cached?.feedback || { accurate: 0, inaccurate: 0 } };
    summaryCache.set(cacheKey, entry);
    saveSummaryCacheToDisk();
    return { ...payload, generatedAt: entry.generatedAt, cached: false, feedback: entry.feedback };
  }
  if (u.pathname === "/api/recall-pack") {
    const name = (u.searchParams.get("name") || "").toLowerCase();
    const q = u.searchParams.get("q") || "";
    const project = projectFilter(u.searchParams.get("project"));
    const domain = domainFilter(u.searchParams.get("domain"));
    const memories = deps.filterMemories(q, deps.cwd, project, domain);
    const observations = deps.filterObservations(q, deps.cwd, project);
    if (name === "architecture") {
      const s = summarizeSection("decisions", memories, observations, true);
      return { name, title: "Current architecture", brief: s.summary.whatIKnow, evidence: s.evidence };
    }
    if (name === "recent-changes") {
      const s = summarizeSection("timeline", memories, observations, true);
      return { name, title: "Recent changes", brief: s.summary.whatIKnow, evidence: s.evidence };
    }
    if (name === "team-preferences") {
      const s = summarizeSection("preferences", memories, observations, true);
      return { name, title: "Team preferences", brief: s.summary.whatIKnow, evidence: s.evidence };
    }
    return { ok: false, error: "unknown pack" };
  }
  if (u.pathname === "/api/summary/feedback") {
    const q = u.searchParams.get("q") || "";
    const project = projectFilter(u.searchParams.get("project"));
    const domain = domainFilter(u.searchParams.get("domain"));
    const strictGrounded = (u.searchParams.get("strict") || "0") === "1";
    const vote = (u.searchParams.get("vote") || "").toLowerCase();
    const cacheKey = `all|${q}|${project || "*"}|${domain || "*"}|${strictGrounded ? 1 : 0}`;
    const cached = summaryCache.get(cacheKey);
    if (!cached) return { ok: false, error: "no cached summary for current filter" };
    if (vote !== "accurate" && vote !== "inaccurate") return { ok: false, error: "invalid vote" };
    cached.feedback[vote] += 1;
    summaryCache.set(cacheKey, cached);
    saveSummaryCacheToDisk();
    return { ok: true, feedback: cached.feedback };
  }
  if (u.pathname === "/api/memory/pin") {
    const id = (u.searchParams.get("id") || "").trim();
    if (!id) return { ok: false, error: "missing id" };
    const store = deps.getStore();
    const hit = store.items.find((x: any) => x.id === id);
    if (!hit) return { ok: false, error: "not found" };
    hit.pinned = true;
    hit.updatedAt = Date.now();
    deps.persist();
    return { ok: true, id, pinned: true };
  }
  if (u.pathname === "/api/memory/unpin") {
    const id = (u.searchParams.get("id") || "").trim();
    if (!id) return { ok: false, error: "missing id" };
    const store = deps.getStore();
    const hit = store.items.find((x: any) => x.id === id);
    if (!hit) return { ok: false, error: "not found" };
    hit.pinned = false;
    hit.updatedAt = Date.now();
    deps.persist();
    return { ok: true, id, pinned: false };
  }
  if (u.pathname === "/api/memory/superpowers-feedback") {
    const id = (u.searchParams.get("id") || "").trim();
    const vote = (u.searchParams.get("vote") || "").trim().toLowerCase();
    if (!id) return { ok: false, error: "missing id" };
    if (vote !== "accepted" && vote !== "rejected") return { ok: false, error: "invalid vote" };
    const store = deps.getStore();
    const hit = store.items.find((x: any) => x.id === id);
    if (!hit) return { ok: false, error: "not found" };
    const meta = { ...(hit.meta || {}) } as any;
    if (vote === "accepted") meta.suggestionAccepted = Number(meta.suggestionAccepted || 0) + 1;
    if (vote === "rejected") meta.suggestionRejected = Number(meta.suggestionRejected || 0) + 1;
    hit.meta = meta;
    hit.updatedAt = Date.now();
    deps.persist();
    return { ok: true, id, vote, accepted: Number(meta.suggestionAccepted || 0), rejected: Number(meta.suggestionRejected || 0) };
  }
  if (u.pathname === "/api/memory/preference-confirm") {
    const id = (u.searchParams.get("id") || "").trim();
    if (!id) return { ok: false, error: "missing id" };
    const store = deps.getStore();
    const hit = store.items.find((x: any) => x.id === id);
    if (!hit) return { ok: false, error: "not found" };
    const current = Number(hit?.meta?.confirmations || 0) + 1;
    hit.meta = { ...(hit.meta || {}), playbookCategory: hit?.meta?.playbookCategory || "preference", confirmations: current };
    if (current >= 3) {
      hit.meta.playbookCategory = "code-rule";
      hit.pinned = true;
    }
    hit.updatedAt = Date.now();
    deps.persist();
    return { ok: true, id, confirmations: current, promoted: current >= 3 };
  }
  return null;
}

export type { UiDeps };
