import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import type { MemoryStore } from "../types";

export function emptyStore(): MemoryStore {
  return { version: 3, items: [], observations: [], domains: {} };
}

export async function loadStore(memPath: string): Promise<MemoryStore> {
  if (!existsSync(memPath)) {
    await mkdir(dirname(memPath), { recursive: true });
    return emptyStore();
  }
  try {
    const raw = await readFile(memPath, "utf8");
    const parsed = JSON.parse(raw || "{}");
    return {
      version: 3,
      items: Array.isArray(parsed.items) ? parsed.items : [],
      observations: Array.isArray(parsed.observations) ? parsed.observations : [],
      domains: parsed?.domains && typeof parsed.domains === "object" ? parsed.domains : {},
    };
  } catch {
    return emptyStore();
  }
}

export async function saveStore(memPath: string, store: MemoryStore) {
  await mkdir(dirname(memPath), { recursive: true });
  await writeFile(memPath, JSON.stringify(store, null, 2), "utf8");
}
