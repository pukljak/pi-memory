import { emptyStore } from "../store/file-store";

export function createHarness() {
  const commands = new Map<string, any>();
  const notifications: Array<{ message: string; level: string }> = [];
  const store = emptyStore();

  const pi = {
    registerCommand(name: string, spec: any) {
      commands.set(name, spec);
    },
  } as any;

  const ctx = {
    cwd: "/repo",
    ui: {
      notify(message: string, level: string = "info") {
        notifications.push({ message, level });
      },
    },
  } as any;

  const deps = {
    getStore: () => store,
    persist: async () => {},
    stats: () => ({ totalItems: store.items.length, projectItems: store.items.length, lessons: store.items.filter((x) => x.kind === "lesson").length, observations: store.observations.length }),
    searchMemory: (q: string) => store.items.filter((x) => x.text.toLowerCase().includes(q.toLowerCase())),
    timeline: () => [],
    summarize: (t: string) => t,
    ensureUi: async () => {},
    getUiPort: () => 37991,
    activeDomainId: () => undefined,
    bindDomainRoot: (domain: string, root: string) => {
      store.domains[domain] = [...(store.domains[domain] || []), root];
    },
    rootForCwd: () => ({ domainId: undefined, root: undefined }),
    normalizePath: (p: string) => p.toLowerCase(),
    scanCodebase: async (root: string, domainId: string) => ({ root, domainId, services: 1, items: 1 }),
    snapshotCodebase: async (root: string, domainId: string) => ({ root, domainId, files: 1, items: 1 }),
    clearPendingRootConfirm: () => {},
    prune: () => ({ scanned: store.items.length, removed: 0, kept: store.items.length, reasons: {}, candidates: [] }),
    projectKeyOf: (cwd: string) => cwd.toLowerCase(),
    uid: () => "test-id",
  } as any;

  return { pi, deps, ctx, commands, notifications, store };
}
