import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { MemoryStore } from "../types";
import { summarize, uid } from "../memory/derive";
import { upsertItems } from "../memory/search";

const IGNORE = new Set([".git", "node_modules", "dist", "build", "out", ".next", "coverage", "bin", "obj", "target"]);

function countLang(name: string, langCounts: Record<string, number>) {
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")).toLowerCase() : "";
  const map: Record<string, string> = { ".ts": "ts", ".tsx": "tsx", ".js": "js", ".jsx": "jsx", ".cs": "csharp", ".go": "go", ".java": "java", ".kt": "kotlin", ".rs": "rust", ".py": "python" };
  const k = map[ext];
  if (k) langCounts[k] = (langCounts[k] || 0) + 1;
}

async function walkFiles(root: string, maxDepth: number, onDir: (dir: string, names: string[]) => Promise<void> | void, onFile: (path: string, name: string) => Promise<void> | void) {
  async function walk(dir: string, depth: number) {
    if (depth > maxDepth) return;
    let entries: any[] = [];
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    const names = entries.map((e) => e.name);
    await onDir(dir, names);
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isFile()) await onFile(full, e.name);
      if (e.isDirectory() && !IGNORE.has(e.name)) await walk(full, depth + 1);
    }
  }
  await walk(root, 0);
}

export async function scanCodebase(store: MemoryStore, root: string, domainId: string, deep = false) {
  const markers = ["package.json", "go.mod", "pom.xml", "build.gradle", "build.gradle.kts", "Cargo.toml", "pyproject.toml", "requirements.txt", "composer.json"];
  const maxDepth = deep ? 7 : 4;
  const found: string[] = [];
  const langCounts: Record<string, number> = {};
  const depHints: Record<string, Set<string>> = {};
  const visitedDirs: string[] = [];

  await walkFiles(root, maxDepth, async (dir, names) => {
    visitedDirs.push(dir);
    const hasService = markers.some((m) => names.includes(m)) || names.some((n) => n.endsWith(".csproj")) || names.includes("Dockerfile") || names.includes("docker-compose.yml");
    if (hasService && dir !== root) found.push(dir);

    if (deep) {
      const txtFile = names.includes("package.json") ? "package.json" : names.includes("go.mod") ? "go.mod" : names.includes("pom.xml") ? "pom.xml" : "";
      if (!txtFile) return;
      try {
        const txt = await readFile(join(dir, txtFile), "utf8");
        const refs = found.filter((s) => s !== dir).map((s) => s.replace(`${root}/`, "").split("/")[0]).filter(Boolean);
        for (const r of refs) if (txt.includes(r)) {
          const me = dir.replace(`${root}/`, "");
          depHints[me] = depHints[me] || new Set<string>();
          depHints[me].add(r);
        }
      } catch {}
    }
  }, async (_full, name) => { if (deep) countLang(name, langCounts); });

  let readme = "";
  try { readme = summarize(await readFile(join(root, "README.md"), "utf8"), 500); } catch {}

  const now = Date.now();
  const items: any[] = [{ id: uid(), kind: "pattern", scope: "domain", domainId, text: `Codebase root for domain '${domainId}': ${root}`, confidence: 0.98, source: "memory_explore", createdAt: now, updatedAt: now }];
  if (found.length) items.push({ id: uid(), kind: "pattern", scope: "domain", domainId, text: `Discovered services/modules (${found.length}): ${found.map((p) => p.replace(`${root}/`, "")).join(", ")}`, confidence: 0.9, source: "memory_explore", createdAt: now, updatedAt: now });
  if (readme) items.push({ id: uid(), kind: "fact", scope: "domain", domainId, text: `README summary (${domainId}): ${readme}`, confidence: 0.78, source: "memory_explore", createdAt: now, updatedAt: now });
  if (deep && Object.keys(langCounts).length) {
    const top = Object.entries(langCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k}:${v}`).join(", ");
    items.push({ id: uid(), kind: "fact", scope: "domain", domainId, text: `Language breakdown (${domainId}): ${top}`, confidence: 0.76, source: "memory_explore", createdAt: now, updatedAt: now });
  }
  if (deep && Object.keys(depHints).length) {
    const lines = Object.entries(depHints).slice(0, 20).map(([k, v]) => `${k} -> ${Array.from(v).join("|")}`);
    items.push({ id: uid(), kind: "pattern", scope: "domain", domainId, text: `Service dependency hints (${domainId}): ${lines.join("; ")}`, confidence: 0.68, source: "memory_explore", createdAt: now, updatedAt: now });
  }

  const covered = found.map((p) => p.replace(`${root}/`, ""));
  const allVisited = visitedDirs.map((d) => d.replace(`${root}/`, "")).filter(Boolean);
  const unknown = allVisited.filter((d) => !covered.some((c) => d === c || d.startsWith(`${c}/`))).slice(0, 25);
  const staleCutoff = Date.now() - (1000 * 60 * 60 * 24 * 14);
  const stale = store.items
    .filter((x) => x.scope === "domain" && x.domainId === domainId && x.source === "memory_explore")
    .filter((x) => x.updatedAt < staleCutoff)
    .length;
  const coverage = {
    coveredCount: covered.length,
    visitedCount: allVisited.length,
    unknownCount: unknown.length,
    staleCount: stale,
    confidence: Math.max(0.2, Math.min(0.99, covered.length / Math.max(1, allVisited.length))),
  };

  items.push({
    id: uid(),
    kind: "fact",
    scope: "domain",
    domainId,
    text: `Explore coverage (${domainId}): covered=${coverage.coveredCount}/${coverage.visitedCount}, unknown=${coverage.unknownCount}, stale=${coverage.staleCount}, confidence=${coverage.confidence.toFixed(2)}; unknown-sample=${unknown.join(", ") || "none"}`,
    confidence: 0.83,
    source: "memory_explore",
    createdAt: now,
    updatedAt: now,
    meta: { coverage },
  });

  upsertItems(store, items);
  return { root, domainId, services: found.length, items: items.length, deep, coverage, unknownSample: unknown };
}

export async function snapshotCodebase(store: MemoryStore, root: string, domainId: string, deep = true) {
  const files: string[] = [];
  const topDirs = new Set<string>();
  const langCounts: Record<string, number> = {};
  const localDeps: Record<string, Set<string>> = {};
  const commands: string[] = [];
  const tools: string[] = [];
  const modelLines: string[] = [];
  const constraints: string[] = [];
  const testFiles: string[] = [];

  await walkFiles(root, deep ? 8 : 5, async (dir) => {
    const rel = relative(root, dir);
    if (rel && !rel.includes("/")) topDirs.add(rel);
  }, async (full, name) => {
    const rel = relative(root, full);
    files.push(rel);
    countLang(name, langCounts);
    if (/\.(test|spec)\./i.test(name) || /__tests__/i.test(rel)) testFiles.push(rel);

    if (!/\.(ts|tsx|js|jsx)$/i.test(name)) return;
    let txt = "";
    try { txt = await readFile(full, "utf8"); } catch { return; }

    const cmdMatches = txt.match(/registerCommand\("([^"]+)"/g) || [];
    for (const m of cmdMatches) commands.push(m.replace(/.*\("/, "").replace(/".*/, ""));
    const toolMatches = txt.match(/name:\s*"([a-z_]+)"/g) || [];
    for (const m of toolMatches) {
      const n = m.replace(/name:\s*"/, "").replace(/"$/, "");
      if (n.startsWith("memory_")) tools.push(n);
    }

    const importMatches = txt.match(/from\s+"(\.\.?\/[^\"]+)"/g) || [];
    if (importMatches.length) {
      localDeps[rel] = localDeps[rel] || new Set<string>();
      for (const im of importMatches) localDeps[rel].add(im.replace(/from\s+"/, "").replace(/"$/, ""));
    }

    if (name === "types.ts") {
      for (const line of txt.split(/\r?\n/)) if (line.trim().startsWith("export type ")) modelLines.push(line.trim());
    }
    for (const m of txt.match(/slice\(0,\s*\d+\)|maxDepth\s*=\s*\w+\s*\?\s*\d+\s*:\s*\d+|length\s*>\s*\d+/g) || []) constraints.push(`${rel}: ${m}`);
  });

  let readme = "";
  try { readme = summarize(await readFile(join(root, "README.md"), "utf8"), 650); } catch {}

  const now = Date.now();
  const lines = Object.entries(localDeps).slice(0, 20).map(([k, v]) => `${k} -> ${Array.from(v).slice(0, 6).join("|")}`);
  const topLangs = Object.entries(langCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k}:${v}`).join(", ");
  const fileIndex = files.filter((f) => /^(index|config|types)\.ts$|^commands\/|^memory\/|^observations\/|^store\/|^tools\/|^ui\/|^explore\//.test(f)).slice(0, 80);

  const items: any[] = [
    { id: uid(), kind: "pattern", scope: "domain", domainId, text: `Architecture snapshot (${domainId}): root=${root}; top-level=${Array.from(topDirs).sort().join(", ")}; composition-root=${files.includes("index.ts") ? "index.ts" : "unknown"}`, confidence: 0.96, source: "memory_snapshot", createdAt: now, updatedAt: now },
    { id: uid(), kind: "pattern", scope: "domain", domainId, text: `File responsibility index (${domainId}): ${fileIndex.join(", ")}`, confidence: 0.9, source: "memory_snapshot", createdAt: now, updatedAt: now },
    { id: uid(), kind: "fact", scope: "domain", domainId, text: `Public contracts (${domainId}): commands=${Array.from(new Set(commands)).sort().join(", ") || "n/a"}; tools=${Array.from(new Set(tools)).sort().join(", ") || "n/a"}`, confidence: 0.93, source: "memory_snapshot", createdAt: now, updatedAt: now },
    { id: uid(), kind: "fact", scope: "domain", domainId, text: `Core data models (${domainId}): ${modelLines.join(" | ") || "not detected"}`, confidence: 0.9, source: "memory_snapshot", createdAt: now, updatedAt: now },
    { id: uid(), kind: "pattern", scope: "domain", domainId, text: `Dependency graph light (${domainId}): ${lines.join("; ") || "not detected"}`, confidence: 0.82, source: "memory_snapshot", createdAt: now, updatedAt: now },
    { id: uid(), kind: "pattern", scope: "domain", domainId, text: `Extension points (${domainId}): commands/register.ts, tools/register.ts, index.ts hooks, explore/codebase.ts heuristics, ui/api.ts + ui/page.ts endpoints/UI.`, confidence: 0.92, source: "memory_snapshot", createdAt: now, updatedAt: now },
    { id: uid(), kind: "fact", scope: "domain", domainId, text: `Persistence details (${domainId}): DEFAULT_MEMORY_PATH from config.ts, file-store.ts load/save JSON, observation cap in observations/capture.ts.`, confidence: 0.88, source: "memory_snapshot", createdAt: now, updatedAt: now },
    { id: uid(), kind: "fact", scope: "domain", domainId, text: `Test map (${domainId}): ${testFiles.length ? testFiles.join(", ") : "no test files detected"}`, confidence: 0.86, source: "memory_snapshot", createdAt: now, updatedAt: now },
    { id: uid(), kind: "fact", scope: "domain", domainId, text: `Runbook (${domainId}): use /memory.status, /memory.search, /memory.timeline, and /memory.ui for daily memory workflows; README=${readme || "not found"}`, confidence: 0.84, source: "memory_snapshot", createdAt: now, updatedAt: now },
    { id: uid(), kind: "lesson", scope: "domain", domainId, text: `Known constraints (${domainId}): ${constraints.slice(0, 20).join("; ") || "none auto-detected"}`, confidence: 0.78, source: "memory_snapshot", createdAt: now, updatedAt: now },
    { id: uid(), kind: "fact", scope: "domain", domainId, text: `Language breakdown (${domainId}): ${topLangs || "n/a"}`, confidence: 0.8, source: "memory_snapshot", createdAt: now, updatedAt: now },
  ];

  upsertItems(store, items);
  return { root, domainId, files: files.length, items: items.length, deep };
}
