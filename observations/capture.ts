import type { MemoryStore, Observation } from "../types";

export function stripPrivateTags(text: string) {
  if (!text) return "";
  return text.replace(/<private>[\s\S]*?<\/private>/gi, "[private-content]").trim();
}

export function inferObservationKind(obs: Pick<Observation, "type" | "title" | "content">): string {
  const t = `${obs.title} ${obs.content}`.toLowerCase();
  if (/\b(error|failed|failure|timeout|exception|gotcha|pitfall|bug)\b/.test(t)) return "gotcha";
  if (/\b(decide|decision|chosen|trade-?off|rationale|because)\b/.test(t)) return "decision";
  if (/\b(changed|updated|refactor|implemented|added|removed|fix(ed)?)\b/.test(t)) return "what-changed";
  if (/\b(discover|learned|found|insight)\b/.test(t)) return "discovery";
  if (obs.type === "user") return "session-request";
  return "how-it-works";
}

export function addObservation(store: MemoryStore, obs: Observation) {
  const kind = inferObservationKind(obs);
  const next: Observation = { ...obs, meta: { ...(obs.meta || {}), obsKind: kind } };
  store.observations.push(next);
  if (store.observations.length > 5000) store.observations = store.observations.slice(-5000);
}

export function textFromContent(content: any): string {
  const blocks = Array.isArray(content) ? content : [];
  return blocks
    .filter((b: any) => b?.type === "text" && typeof b?.text === "string")
    .map((b: any) => stripPrivateTags(String(b.text)))
    .join("\n")
    .trim();
}
