import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export type Deps = {
  getStore: () => any;
  persist: () => Promise<void>;
  stats: (cwd: string) => any;
  searchMemory: (q: string, cwd: string) => any[];
  timeline: (id: string, cwd: string, before?: number, after?: number) => any[];
  summarize: (t: string, max?: number) => string;
  ensureUi: (ctx: any) => Promise<void>;
  getUiPort: () => number;
  activeDomainId: (cwd: string) => string | undefined;
  bindDomainRoot: (domain: string, root: string) => void;
  rootForCwd: (cwd: string) => { domainId?: string; root?: string };
  normalizePath: (p: string) => string;
  scanCodebase: (root: string, domainId: string, deep?: boolean) => Promise<any>;
  snapshotCodebase: (root: string, domainId: string, deep?: boolean) => Promise<any>;
  clearPendingRootConfirm: () => void;
  prune: (dryRun?: boolean) => { scanned: number; removed: number; kept: number; reasons: Record<string, number>; candidates: { id: string; score: number; reason: string }[] };
  projectKeyOf: (cwd: string) => string;
  uid: () => string;
};

export type RegisterFn = (pi: ExtensionAPI, deps: Deps) => void;
