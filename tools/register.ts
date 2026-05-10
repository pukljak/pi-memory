import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Kind, MemoryItem, Scope } from "../types";

type Deps = {
  getStore: () => any;
  persist: () => Promise<void>;
  searchMemory: (q: string, cwd: string) => any[];
  stats: (cwd: string) => any;
  timeline: (id: string, cwd: string, before?: number, after?: number) => any[];
  upsertItems: (items: any[]) => void;
  projectKeyOf: (cwd: string) => string;
  activeDomainId: (cwd: string) => string | undefined;
  uid: () => string;
};

export function registerTools(pi: ExtensionAPI, deps: Deps) {
  pi.registerTool({ name: "memory_search", label: "Memory Search", description: "Search saved memory", parameters: Type.Object({ query: Type.String() }), async execute(_id, params, _s, _u, ctx) { const items = deps.searchMemory(params.query, ctx.cwd).slice(0, 20); return { content: [{ type: "text", text: JSON.stringify(items, null, 2) }], details: { count: items.length } }; } });

  pi.registerTool({
    name: "memory_remember",
    label: "Memory Remember",
    description: "Store a memory fact",
    parameters: Type.Object({ text: Type.String(), kind: Type.Optional(Type.Union([Type.Literal("preference"), Type.Literal("pattern"), Type.Literal("lesson"), Type.Literal("fact")])), scope: Type.Optional(Type.Union([Type.Literal("global"), Type.Literal("project"), Type.Literal("domain")])), domainId: Type.Optional(Type.String()), confidence: Type.Optional(Type.Number()) }),
    async execute(_id, params, _s, _u, ctx) {
      const now = Date.now();
      const scope = (params.scope as Scope) || "project";
      const item: MemoryItem = { id: deps.uid(), kind: (params.kind as Kind) || "fact", scope, projectKey: deps.projectKeyOf(ctx.cwd), domainId: scope === "domain" ? (params.domainId || deps.activeDomainId(ctx.cwd) || "default") : undefined, text: params.text, confidence: Math.max(0.1, Math.min(1, params.confidence ?? 0.95)), source: "memory_remember", createdAt: now, updatedAt: now };
      deps.upsertItems([item]);
      await deps.persist();
      return { content: [{ type: "text", text: `Saved ${item.kind}: ${item.text}` }], details: item };
    },
  });

  pi.registerTool({ name: "memory_forget", label: "Memory Forget", description: "Delete memory by id or text query", parameters: Type.Object({ query: Type.String() }), async execute(_id, params) { const q = params.query.toLowerCase().trim(); const store = deps.getStore(); const before = store.items.length; store.items = store.items.filter((x: any) => !(x.id === q || x.text.toLowerCase().includes(q))); const removed = before - store.items.length; await deps.persist(); return { content: [{ type: "text", text: `Removed ${removed} memory item(s)` }], details: { removed } }; } });
  pi.registerTool({ name: "memory_stats", label: "Memory Stats", description: "Show memory statistics", parameters: Type.Object({}), async execute(_id, _p, _s, _u, ctx) { const s = deps.stats(ctx.cwd); return { content: [{ type: "text", text: JSON.stringify(s, null, 2) }], details: s }; } });
  pi.registerTool({ name: "memory_timeline", label: "Memory Timeline", description: "Find timeline around an observation id", parameters: Type.Object({ id: Type.String(), before: Type.Optional(Type.Number()), after: Type.Optional(Type.Number()) }), async execute(_id, params, _s, _u, ctx) { const data = deps.timeline(params.id, ctx.cwd, params.before ?? 5, params.after ?? 5); return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], details: { count: data.length } }; } });
}
