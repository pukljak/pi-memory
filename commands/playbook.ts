import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Deps } from "./types";
import { makeScopedMemoryItem } from "./helpers";

export function registerPlaybookCommands(pi: ExtensionAPI, deps: Deps) {
  pi.registerCommand("memory.rule", { description: "Manage code rules: /memory.rule add <text>", handler: async (args, ctx) => { const raw = (args || "").trim(); const m = raw.match(/^add\s+(.+)$/i); if (!m) return ctx.ui.notify("Usage: /memory.rule add <text>", "error"); const store = deps.getStore(); const domainId = deps.activeDomainId(ctx.cwd); store.items.push(makeScopedMemoryItem({ uid: deps.uid, projectKeyOf: deps.projectKeyOf, cwd: ctx.cwd, domainId, kind: "lesson", text: m[1].trim(), confidence: 0.95, source: "memory_playbook", pinned: true, meta: { playbookCategory: "code-rule" } })); await deps.persist(); ctx.ui.notify("Rule saved", "info"); } });
  pi.registerCommand("memory.preference", { description: "Manage preferences: /memory.preference add <text>", handler: async (args, ctx) => { const raw = (args || "").trim(); const m = raw.match(/^add\s+(.+)$/i); if (!m) return ctx.ui.notify("Usage: /memory.preference add <text>", "error"); const store = deps.getStore(); const domainId = deps.activeDomainId(ctx.cwd); store.items.push(makeScopedMemoryItem({ uid: deps.uid, projectKeyOf: deps.projectKeyOf, cwd: ctx.cwd, domainId, kind: "preference", text: m[1].trim(), confidence: 0.9, source: "memory_playbook", meta: { playbookCategory: "preference", confirmations: 1 } })); await deps.persist(); ctx.ui.notify("Preference saved", "info"); } });
}
