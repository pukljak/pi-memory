import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { basename, join, resolve } from "node:path";
import { homedir } from "node:os";
import type { Server } from "node:http";
import type { MemoryStore } from "./types";
import { DEFAULT_MEMORY_PATH, DEFAULT_UI_PORT, EXT_STATE_KEY } from "./config";
import { loadStore, saveStore, emptyStore } from "./store/file-store";
import { stats, listDomains, listProjects } from "./store/state";
import { activeDomainId, bindDomainRoot, normalizePath, projectKeyOf, rootForCwd } from "./memory/scope";
import { deriveMemories, summarize, uid } from "./memory/derive";
import { buildMemoryIndexBlock, filterMemories, filterObservations, searchMemory, upsertItems } from "./memory/search";
import { pruneMemories } from "./memory/retention";
import { autoClassifyPlaybookItems, buildPlaybookGuardrails, isCodingWorkPrompt, promoteConfirmedPreferences } from "./memory/playbook";
import { addObservation, stripPrivateTags, textFromContent } from "./observations/capture";
import { timeline } from "./observations/timeline";
import { scanCodebase, snapshotCodebase } from "./explore/codebase";
import { startUiServer } from "./ui/server";
import { registerTools } from "./tools/register";
import { registerCommands } from "./commands/register";

export default function memoryPlus(pi: ExtensionAPI) {
  let memPath = "";
  let store: MemoryStore = emptyStore();
  let pendingRootConfirm: { suggestedRoot: string } | null = null;
  let uiServer: Server | null = null;
  let uiPort = DEFAULT_UI_PORT;
  let sessionId = "unknown";

  const persist = async () => saveStore(memPath, store);
  const getStore = () => store;
  const prune = (dryRun = false) => pruneMemories(store, { dryRun });

  function buildFileReadGateBlock(cwd: string, prompt: string) {
    const key = projectKeyOf(cwd);
    const fileRefs = Array.from(new Set((prompt.match(/[~./\w-]+\.(?:ts|tsx|js|jsx|json|md|py|go|cs|java|kt|rs|sql|yaml|yml)/gi) || []).map((x) => x.toLowerCase()))).slice(0, 3);
    if (!fileRefs.length) return "";
    const hits: any[] = [];
    for (const f of fileRefs) {
      const matched = store.observations
        .filter((o) => o.projectKey === key)
        .filter((o) => o.title.toLowerCase().includes(f) || o.content.toLowerCase().includes(f))
        .sort((a, b) => b.at - a.at)
        .slice(0, 3);
      for (const m of matched) hits.push(m);
    }
    const uniq = Array.from(new Map(hits.map((h) => [h.id, h])).values()).slice(0, 6);
    if (!uniq.length) return "";
    const rows = uniq.map((o) => `- (${o.id}) [${(o.meta as any)?.obsKind || o.type}] ${o.title} @ ${new Date(o.at).toLocaleString()}`);
    return [
      "<file_read_gate>",
      "This request references files with prior observations. Cheapest path: review timeline/observations first, then read code if still needed.",
      ...rows,
      "Tip: /memory.timeline <id>",
      "</file_read_gate>",
    ].join("\n");
  }

  function autoSummarizeClusters(cwd: string) {
    const key = projectKeyOf(cwd);
    const domainId = activeDomainId(store, cwd);
    const now = Date.now();
    const recent = store.items.filter((x) => (now - x.updatedAt) < 1000 * 60 * 90).filter((x) => x.scope === "project" ? x.projectKey === key : (x.scope === "domain" ? x.domainId === domainId : false));
    const groups = new Map<string, any[]>();
    for (const it of recent) {
      const head = it.text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean).slice(0, 5).join(" ");
      if (head.length < 16) continue;
      const arr = groups.get(head) || [];
      arr.push(it);
      groups.set(head, arr);
    }
    for (const [head, arr] of groups) {
      if (arr.length < 3) continue;
      const samples = arr.slice(0, 3).map((x) => x.text).join(" | ");
      const summary = {
        id: uid(),
        kind: "fact",
        scope: domainId ? "domain" : "project",
        projectKey: domainId ? undefined : key,
        domainId: domainId || undefined,
        text: `Auto-summary cluster: ${arr.length} related memories around '${head}': ${samples}`,
        confidence: 0.74,
        source: "memory_autosummary",
        createdAt: now,
        updatedAt: now,
      } as any;
      upsertItems(store, [summary]);
    }
  }

  function suggestSkillsBlock(prompt: string) {
    const p = (prompt || "").toLowerCase();
    const suggestions: { name: string; why: string }[] = [];
    const add = (name: string, why: string) => {
      if (!suggestions.find((x) => x.name === name)) suggestions.push({ name, why });
    };

    if (/\b(next\.js|nextjs|app router|rsc|route handler|metadata)\b/.test(p)) add("next-best-practices", "Next.js architecture, RSC boundaries, and data patterns");
    if (/\b(browser|devtools|network|performance|lighthouse|chrome)\b/.test(p)) add("chrome-devtools", "Browser debugging and network/performance inspection");
    if (/\b(prd|product requirements|requirements doc|spec)\b/.test(p)) add("prd", "Generate or refine a PRD/spec");
    if (/\b(research|search web|tavily|exa|rag|fact-check|internet)\b/.test(p)) add("web-search", "Web research and content extraction workflows");
    if (/\b(review|pre-commit|risk|clean architecture|\.net|asp\.net|grpc|kafka|redis|rabbitmq)\b/.test(p)) add("code-review-hardcore", "Strict risk-focused code review for .NET services");
    if (/\b(find skill|is there a skill|install skill|plugin)\b/.test(p)) add("find-skills", "Discover/install relevant skills");
    if (/\b(create skill|improve skill|optimize skill|skill eval|benchmark skill)\b/.test(p)) add("skill-creator", "Create, edit, and evaluate skills");
    if (/\b(library internals|source code reference|github lines|why changed in library)\b/.test(p)) add("librarian", "Evidence-backed OSS/library research with source citations");

    if (!suggestions.length) return "";
    return ["<skill_suggestions>", "Potentially useful skills for this task:", ...suggestions.slice(0, 4).map((s, i) => `${i + 1}. ${s.name} — ${s.why}`), "</skill_suggestions>"].join("\n");
  }

  function autoRecordDomainLearning(cwd: string, assistantTexts: string[]) {
    const domainId = activeDomainId(store, cwd);
    if (!domainId) return;
    const now = Date.now();
    const pKey = projectKeyOf(cwd);

    const fromAssistant = deriveMemories(assistantTexts.join("\n"), pKey)
      .map((m) => ({ ...m, id: uid(), scope: "domain" as const, domainId, projectKey: undefined, source: "agent_end:auto_domain" }));

    const toolObs = store.observations.filter((o) => o.sessionId === sessionId && o.projectKey === pKey && o.type === "tool");
    const touched = new Set<string>();
    for (const o of toolObs) {
      const matches = o.content.matchAll(/[~./\w-]+\.(?:ts|tsx|js|jsx|json|md|py|go|cs|java|kt|rs|sql|yaml|yml)/gi);
      for (const m of matches) if (m?.[0]) touched.add(m[0]);
    }

    const structured: any[] = [];
    const lines = assistantTexts.join("\n").split(/\r?\n/).map((x) => x.trim()).filter(Boolean).slice(0, 400);
    const pick = (re: RegExp, max = 4) => lines.filter((l) => re.test(l.toLowerCase()) && l.length > 12).slice(0, max);
    const changes = pick(/\b(implemented|added|fixed|updated|refactor|changed|shipped)\b/i);
    const decisions = pick(/\b(decision|decided|rationale|trade[- ]?off|chose|chosen|because)\b/i);
    const gotchas = pick(/\b(gotcha|pitfall|risk|warning|caveat|watch out|breaking)\b/i);
    const followups = pick(/\b(todo|follow[- ]?up|next step|later|remaining|future work)\b/i);

    const mk = (kind: "fact" | "lesson", label: string, arr: string[], conf: number) => {
      if (!arr.length) return;
      structured.push({
        id: uid(),
        kind,
        scope: "domain",
        domainId,
        text: `Task learned (${domainId}) ${label}: ${arr.map((x) => summarize(x, 160)).join(" | ")}`,
        confidence: conf,
        source: "agent_end:auto_task_learning",
        createdAt: now,
        updatedAt: now,
        meta: { taskLearningType: label.toLowerCase().replace(/\s+/g, "-") },
      });
    };

    mk("fact", "what-changed", changes, 0.84);
    mk("fact", "decision", decisions, 0.82);
    mk("lesson", "gotcha", gotchas, 0.86);
    mk("lesson", "follow-up", followups, 0.8);

    const learned: any[] = [...fromAssistant, ...structured];
    if (touched.size) {
      learned.push({
        id: uid(),
        kind: "pattern",
        scope: "domain",
        domainId,
        text: `Session touched files (${domainId}): ${Array.from(touched).slice(0, 50).join(", ")}`,
        confidence: 0.72,
        source: "agent_end:auto_domain",
        createdAt: now,
        updatedAt: now,
      });
    }

    if (learned.length) upsertItems(store, learned);
  }

  async function ensureUi(ctx: any) {
    if (uiServer) return;
    uiServer = await startUiServer(uiPort, store, {
      cwd: ctx.cwd,
      listProjects: () => listProjects(store),
      listDomains: () => listDomains(store),
      filterMemories: (q, cwd, project, domain) => filterMemories(store, q, cwd, project, domain),
      filterObservations: (q, cwd, project) => filterObservations(store, q, cwd, project),
      timeline: (id, cwd, before, after) => timeline(store, id, cwd, before ?? 5, after ?? 5),
      stats: (cwd) => stats(store, cwd),
      getStore,
      persist,
    });
  }

  pi.on("session_start", async (event, ctx) => {
    sessionId = (ctx.sessionManager.getSessionFile?.() || `session-${Date.now()}`) as string;
    memPath = join(homedir(), ...DEFAULT_MEMORY_PATH);
    store = await loadStore(memPath);
    const prev = ctx.sessionManager.getEntries().find((e: any) => e.type === "custom" && e.customType === EXT_STATE_KEY);
    if (prev?.data?.port) uiPort = prev.data.port;
    addObservation(store, { id: uid(), sessionId, projectKey: projectKeyOf(ctx.cwd), at: Date.now(), type: "system", title: `session_start:${event.reason}`, content: `Session started (${event.reason})` });
    promoteConfirmedPreferences(store, 3);
    const startupPrune = prune(false);
    await persist();
    if (startupPrune.removed) ctx.ui.notify(`Pi Memory: auto-pruned ${startupPrune.removed} stale/low-value memories`, "info");
    ctx.ui.setStatus("pi-memory", `mem ${store.items.length} · obs ${store.observations.length}`);
  });

  pi.on("before_agent_start", async (event, ctx) => {
    const prompt = stripPrivateTags(event.prompt || "");
    const low = prompt.toLowerCase();
    addObservation(store, { id: uid(), sessionId, projectKey: projectKeyOf(ctx.cwd), at: Date.now(), type: "user", title: "prompt", content: summarize(prompt, 800) });

    const setRoot = prompt.match(/(?:codebase\s+root\s+is|set\s+codebase\s+root\s*:?)[\s\"]+([^\n\"]+)/i);
    if (setRoot?.[1]) {
      const root = resolve(ctx.cwd, setRoot[1].trim());
      const domain = activeDomainId(store, ctx.cwd) || basename(root).toLowerCase();
      bindDomainRoot(store, domain, root);
      await persist();
      ctx.ui.notify(`Pi Memory: codebase root set to ${root} (domain: ${domain})`, "success");
    }

    const confirmsRoot = /^(yes|yep|this is root|use this root)\b/i.test(low.trim());
    const definesRoot = /root\s+is\s+\S+/i.test(low);
    if (pendingRootConfirm && (confirmsRoot || definesRoot)) {
      let root = pendingRootConfirm.suggestedRoot;
      const m = prompt.match(/root\s+is\s+(.+)$/i);
      if (m?.[1]) root = resolve(ctx.cwd, m[1].trim());
      const domain = activeDomainId(store, ctx.cwd) || basename(root).toLowerCase();
      bindDomainRoot(store, domain, root);
      pendingRootConfirm = null;
      await persist();
      ctx.ui.notify(`Pi Memory: bound root ${root} to domain ${domain}`, "success");
    }

    const exploreTriggered = /(explore\s+my\s+codebase|explore\s+codebase|explore\s+my\s+code|explore\s+code)/i.test(low);
    if (exploreTriggered && !activeDomainId(store, ctx.cwd)) {
      pendingRootConfirm = { suggestedRoot: ctx.cwd };
      const ask = `Before exploring, confirm codebase root. Suggested root: ${ctx.cwd}. Reply: 'yes' or 'root is <path>'.`;
      ctx.ui.notify(`Pi Memory: ${ask}`, "info");
      return { message: { customType: "pi-memory-root-confirm", content: ask, display: true } };
    }

    if (exploreTriggered) {
      const { domainId, root } = rootForCwd(store, ctx.cwd);
      if (domainId && root) {
        const info = await scanCodebase(store, root, domainId, false);
        await persist();
        ctx.ui.notify(`Pi Memory: explored ${info.root} (domain ${info.domainId}), services=${info.services}, coverage=${info.coverage?.coveredCount || 0}/${info.coverage?.visitedCount || 0}`, "success");
      }
    }

    const parts: string[] = [];
    if (isCodingWorkPrompt(prompt)) {
      const guardrails = buildPlaybookGuardrails(store, ctx.cwd);
      if (guardrails) parts.push(guardrails);
    }
    const skillSuggestions = suggestSkillsBlock(prompt);
    if (skillSuggestions) parts.push(skillSuggestions);
    const gate = buildFileReadGateBlock(ctx.cwd, prompt);
    if (gate) parts.push(gate);
    const block = buildMemoryIndexBlock(store, prompt, ctx.cwd);
    if (block) parts.push(block);
    if (!parts.length) return;
    return { message: { customType: "pi-memory", content: parts.join("\n\n"), display: false } };
  });

  pi.on("tool_execution_end", async (event, ctx) => {
    const detailText = summarize(JSON.stringify(event.result?.details || {}).slice(0, 1200), 320);
    const outText = summarize(textFromContent(event.result?.content), 600);
    const content = outText || detailText || "(no text)";
    const referencedFiles = Array.from(new Set((content.match(/[~./\w-]+\.(?:ts|tsx|js|jsx|json|md|py|go|cs|java|kt|rs|sql|yaml|yml)/gi) || []).map((x) => x.toLowerCase()))).slice(0, 24);
    const referencedSymbols = Array.from(new Set(Array.from(content.matchAll(/\b([A-Z][A-Za-z0-9_]{2,}|[a-z][A-Za-z0-9_]{2,})\s*\(/g)).map((m) => m[1]))).slice(0, 24);
    addObservation(store, { id: uid(), sessionId, projectKey: projectKeyOf(ctx.cwd), at: Date.now(), type: "tool", title: event.toolName, content, meta: { isError: event.isError, toolCallId: event.toolCallId, referencedFiles, referencedSymbols } });
  });

  pi.on("agent_end", async (event, ctx) => {
    const texts: string[] = [];
    for (const m of event.messages || []) {
      const t = textFromContent((m as any)?.content);
      if (t) texts.push(t);
      addObservation(store, { id: uid(), sessionId, projectKey: projectKeyOf(ctx.cwd), at: Date.now(), type: "assistant", title: "assistant_message", content: summarize(t || "(no text)", 900) });
    }
    const candidate = deriveMemories(texts.join("\n"), projectKeyOf(ctx.cwd));
    if (candidate.length) {
      autoClassifyPlaybookItems(candidate as any);
      upsertItems(store, candidate);
    }
    autoRecordDomainLearning(ctx.cwd, texts);
    autoClassifyPlaybookItems(store.items as any);
    autoSummarizeClusters(ctx.cwd);
    promoteConfirmedPreferences(store, 3);
    const endPrune = prune(false);
    await persist();
    if (endPrune.removed) ctx.ui.notify(`Pi Memory: auto-pruned ${endPrune.removed} stale/low-value memories`, "info");
    ctx.ui.setStatus("pi-memory", `mem ${store.items.length} · obs ${store.observations.length}`);
  });

  pi.on("session_shutdown", async (event, ctx) => {
    addObservation(store, { id: uid(), sessionId, projectKey: projectKeyOf(ctx.cwd), at: Date.now(), type: "system", title: `session_shutdown:${event.reason}`, content: `Session shutdown (${event.reason})` });
    await persist();
    pi.appendEntry(EXT_STATE_KEY, { port: uiPort, ts: Date.now() });
    if (uiServer) { uiServer.close(); uiServer = null; }
    ctx.ui.setStatus("pi-memory", "");
  });

  registerTools(pi, {
    getStore,
    persist,
    searchMemory: (q, cwd) => searchMemory(store, q, cwd),
    stats: (cwd) => stats(store, cwd),
    timeline: (id, cwd, before, after) => timeline(store, id, cwd, before, after),
    upsertItems: (items) => upsertItems(store, items),
    projectKeyOf,
    activeDomainId: (cwd) => activeDomainId(store, cwd),
    uid,
  });

  registerCommands(pi, {
    getStore,
    persist,
    stats: (cwd) => stats(store, cwd),
    searchMemory: (q, cwd) => searchMemory(store, q, cwd),
    timeline: (id, cwd, before, after) => timeline(store, id, cwd, before, after),
    summarize,
    ensureUi,
    getUiPort: () => uiPort,
    activeDomainId: (cwd) => activeDomainId(store, cwd),
    bindDomainRoot: (domain, root) => bindDomainRoot(store, domain, root),
    rootForCwd: (cwd) => rootForCwd(store, cwd),
    normalizePath,
    scanCodebase: (root, domainId, deep) => scanCodebase(store, root, domainId, deep),
    snapshotCodebase: (root, domainId, deep) => snapshotCodebase(store, root, domainId, deep),
    clearPendingRootConfirm: () => { pendingRootConfirm = null; },
    prune,
    projectKeyOf,
    uid,
  });
}
