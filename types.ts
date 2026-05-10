export type Kind = "preference" | "pattern" | "lesson" | "fact";
export type Scope = "global" | "project" | "domain";

export type MemoryItem = {
  id: string;
  kind: Kind;
  scope: Scope;
  projectKey?: string;
  domainId?: string;
  text: string;
  confidence: number;
  qualityScore?: number;
  source: string;
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  seenCount?: number;
  lastSeenAt?: number;
  meta?: Record<string, unknown>;
};

export type Observation = {
  id: string;
  sessionId: string;
  projectKey: string;
  at: number;
  type: "tool" | "assistant" | "user" | "system";
  title: string;
  content: string;
  meta?: Record<string, unknown>;
};

export type MemoryStore = {
  version: 3;
  items: MemoryItem[];
  observations: Observation[];
  domains: Record<string, string[]>;
};
