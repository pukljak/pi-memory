import type { MemoryStore } from "../types";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function parseOutcomeSignal(title: string, content: string) {
  const t = `${title} ${content}`.toLowerCase();
  const looksTest = /\b(test|jest|vitest|pytest|mocha|pnpm test|npm test|go test|dotnet test)\b/.test(t);
  if (!looksTest) return null;
  const failed = /\b(fail|failing|failed|error|errors)\b/.test(t);
  const passed = /\b(pass|passed|ok|all tests passed|0 failed)\b/.test(t);
  if (failed && !passed) return "failed" as const;
  if (passed && !failed) return "passed" as const;
  return null;
}

export function applyOutcomeLearning(store: MemoryStore, projectKey: string, sessionId: string) {
  const now = Date.now();
  const toolObs = store.observations.filter((o) => o.type === "tool" && o.projectKey === projectKey && o.sessionId === sessionId);
  const testObs = toolObs
    .map((o) => ({ o, signal: parseOutcomeSignal(o.title || "", o.content || "") }))
    .filter((x) => !!x.signal) as Array<{ o: any; signal: "passed" | "failed" }>;

  if (!testObs.length) return { adjusted: 0, signals: 0 };

  let adjusted = 0;
  for (const { o, signal } of testObs) {
    const files = new Set<string>(Array.isArray(o?.meta?.referencedFiles) ? o.meta.referencedFiles.map((x: string) => String(x).toLowerCase()) : []);
    const delta = signal === "passed" ? 0.02 : -0.035;

    for (const item of store.items) {
      if (item.scope !== "project" || item.projectKey !== projectKey) continue;
      const links = Array.isArray((item.meta as any)?.links) ? (item.meta as any).links : [];
      const linkFiles = new Set<string>(links.map((l: any) => String(l?.file || "").toLowerCase()).filter(Boolean));
      const txt = String(item.text || "").toLowerCase();
      const intersects = files.size > 0 && [...files].some((f) => linkFiles.has(f) || txt.includes(f));
      if (!intersects) continue;

      item.confidence = clamp(Number(item.confidence || 0.6) + delta, 0.3, 0.99);
      item.qualityScore = clamp(Number(item.qualityScore || item.confidence) + delta * 0.8, 0, 1);
      item.updatedAt = now;
      const meta = (item.meta || {}) as any;
      meta.lastOutcome = signal;
      meta.outcomeAdjustedAt = now;
      item.meta = meta;
      adjusted++;
    }
  }

  return { adjusted, signals: testObs.length };
}
