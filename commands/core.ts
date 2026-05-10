import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Deps } from "./types";

export function registerCoreCommands(pi: ExtensionAPI, deps: Deps) {
  pi.registerCommand("memory.status", { description: "Show memory status", handler: async (_args, ctx) => { const s = deps.stats(ctx.cwd); ctx.ui.notify(`Pi Memory: items=${s.totalItems} project=${s.projectItems} lessons=${s.lessons} obs=${s.observations}`, "info"); } });
  pi.registerCommand("memory.search", { description: "Search memory: /memory.search <query>", handler: async (args, ctx) => { const q = (args || "").trim(); if (!q) return ctx.ui.notify("Usage: /memory.search <query>", "error"); const items = deps.searchMemory(q, ctx.cwd).slice(0, 20); if (!items.length) return ctx.ui.notify("No matches", "info"); ctx.ui.notify(items.map((x: any) => `- (${x.id}) [${x.kind}] ${x.text}`).join("\n"), "info"); } });
  pi.registerCommand("memory.timeline", { description: "Timeline around obs id: /memory.timeline <id>", handler: async (args, ctx) => { const id = (args || "").trim(); if (!id) return ctx.ui.notify("Usage: /memory.timeline <observation-id>", "error"); const t = deps.timeline(id, ctx.cwd, 4, 4); if (!t.length) return ctx.ui.notify("No timeline for this id", "info"); ctx.ui.notify(t.map((x: any) => `${x.id} | ${x.type} | ${x.title} | ${new Date(x.at).toLocaleTimeString()}\n${deps.summarize(x.content, 140)}`).join("\n\n"), "info"); } });
  pi.registerCommand("memory.ui", { description: "Open local memory web UI", handler: async (_args, ctx) => { await deps.ensureUi(ctx); ctx.ui.notify(`Memory UI: http://127.0.0.1:${deps.getUiPort()}`, "info"); } });
}
