import type { MemoryItem, MemoryStore } from "../types";
import { activeDomainId, matchProject, projectKeyOf } from "./scope";

export const PLAYBOOK_CATEGORIES = ["code-rule", "code-standard", "good-example", "bad-example", "decision"] as const;

export function isCodingWorkPrompt(prompt: string) {
  const p = (prompt || "").toLowerCase();
  return /(implement|fix|refactor|create|add|update|edit|write|change|bug|feature|endpoint|api|component|service|class|function|test|schema|migration|query|build)/i.test(p);
}

export function promoteConfirmedPreferences(store: MemoryStore, threshold = 3) {
  let promoted = 0;
  for (const m of store.items) {
    const cat = String((m.meta as any)?.playbookCategory || "");
    const confirmations = Number((m.meta as any)?.confirmations || 0);
    if (cat === "preference" && confirmations >= threshold) {
      m.meta = { ...(m.meta || {}), playbookCategory: "code-rule", promotedFromPreference: true, promotedAt: Date.now() };
      m.pinned = true;
      m.updatedAt = Date.now();
      promoted++;
    }
  }
  return promoted;
}

function linesFor(store: MemoryStore, cwd: string, category: string, limit: number) {
  return store.items
    .filter((x) => matchProject(store, x, cwd))
    .filter((x) => String((x.meta as any)?.playbookCategory || "") === category)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit)
    .map((x) => `- (${x.id}) ${x.text}`);
}

export function buildPlaybookGuardrails(store: MemoryStore, cwd: string) {
  const rules = linesFor(store, cwd, "code-rule", 8);
  const standards = linesFor(store, cwd, "code-standard", 6);
  const decisions = linesFor(store, cwd, "decision", 5);
  if (!rules.length && !standards.length && !decisions.length) return "";
  const domain = activeDomainId(store, cwd) || "project";
  const out: string[] = ["<playbook_guardrails>", `Apply these guardrails for ${domain} before coding:`];
  if (rules.length) out.push("Rules:", ...rules);
  if (standards.length) out.push("Standards:", ...standards);
  if (decisions.length) out.push("Decisions:", ...decisions);
  out.push("</playbook_guardrails>");
  return out.join("\n");
}

export function makePlaybookItem(store: MemoryStore, cwd: string, text: string, category: string): MemoryItem {
  const now = Date.now();
  const domainId = activeDomainId(store, cwd);
  const scope = domainId ? "domain" : "project";
  return {
    id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    kind: category === "code-rule" || category === "decision" ? "lesson" : "pattern",
    scope,
    projectKey: scope === "project" ? projectKeyOf(cwd) : undefined,
    domainId: scope === "domain" ? domainId : undefined,
    text,
    confidence: 0.92,
    source: "memory_playbook",
    createdAt: now,
    updatedAt: now,
    pinned: category === "code-rule",
    meta: { playbookCategory: category },
  };
}

function inferPlaybookCategory(text: string, kind: string): string | undefined {
  const t = (text || "").toLowerCase();
  if (!t || t.length < 16) return undefined;
  if (/\b(good example|best practice example|recommended example)\b/.test(t)) return "good-example";
  if (/\b(bad example|anti-pattern|avoid this pattern|pitfall)\b/.test(t)) return "bad-example";
  if (/\b(decision|decided|rationale|trade[- ]?off|chose|chosen|because)\b/.test(t)) return "decision";
  if (/\b(must|never|do not|don't|avoid|forbidden|required|always)\b/.test(t)) return "code-rule";
  if (kind === "preference" || /\b(prefer|preference|please use|we use|convention|standard|pattern)\b/.test(t)) return kind === "preference" ? "preference" : "code-standard";
  return undefined;
}

export function autoClassifyPlaybookItems(items: MemoryItem[], pinThreshold = 3) {
  let tagged = 0;
  for (const it of items || []) {
    if (!it) continue;
    const existingCat = String((it.meta as any)?.playbookCategory || "");
    const cat = existingCat || inferPlaybookCategory(it.text || "", it.kind || "");
    if (!cat) continue;
    const prevConf = Number((it.meta as any)?.confirmations || 0);
    const confirmations = Math.max(1, prevConf || (existingCat ? 1 : 1));
    it.meta = { ...(it.meta || {}), playbookCategory: cat, autoClassified: true, autoClassifiedAt: Date.now(), confirmations };
    if ((cat === "code-rule" || cat === "decision") && confirmations >= pinThreshold) it.pinned = true;
    if ((cat === "code-rule" || cat === "decision") && confirmations < pinThreshold) it.pinned = Boolean(it.pinned && prevConf >= pinThreshold);
    if (cat === "code-standard" && it.kind === "lesson") it.kind = "pattern" as any;
    tagged++;
  }
  return tagged;
}
