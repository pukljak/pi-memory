import type { Kind, Scope } from "../types";

type ScopedInput = {
  uid: () => string;
  projectKeyOf: (cwd: string) => string;
  cwd: string;
  domainId?: string;
  kind: Kind;
  text: string;
  confidence: number;
  source: string;
  pinned?: boolean;
  meta?: Record<string, unknown>;
};

export function makeScopedMemoryItem(input: ScopedInput) {
  const now = Date.now();
  const scope: Scope = input.domainId ? "domain" : "project";
  return {
    id: input.uid(),
    kind: input.kind,
    scope,
    projectKey: input.domainId ? undefined : input.projectKeyOf(input.cwd),
    domainId: input.domainId || undefined,
    text: input.text,
    confidence: input.confidence,
    source: input.source,
    createdAt: now,
    updatedAt: now,
    pinned: input.pinned,
    meta: input.meta,
  };
}
