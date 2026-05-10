import type { MemoryStore } from "../types";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function adaptMemoryScores(store: MemoryStore) {
  const now = Date.now();
  let touched = 0;

  for (const item of store.items) {
    const meta = (item.meta || {}) as any;
    const accepted = Number(meta.suggestionAccepted || 0);
    const rejected = Number(meta.suggestionRejected || 0);
    const confirmations = Number(meta.confirmations || 0);
    const totalFeedback = Math.max(1, accepted + rejected);
    const ageDays = Math.max(0, Math.floor((now - Number(item.updatedAt || now)) / (1000 * 60 * 60 * 24)));

    const feedbackDelta = ((accepted - rejected) / totalFeedback) * 0.08;
    const confirmationBoost = Math.min(confirmations, 5) * 0.01;
    const stalePenalty = ageDays > 30 ? Math.min(0.12, (ageDays - 30) * 0.002) : 0;

    const nextConfidence = clamp((Number(item.confidence || 0.6) + feedbackDelta + confirmationBoost - stalePenalty), 0.35, 0.98);
    const nextQuality = clamp(nextConfidence + (item.pinned ? 0.05 : 0) - stalePenalty * 0.5, 0, 1);

    item.confidence = nextConfidence;
    item.qualityScore = nextQuality;

    if (ageDays > 60 && accepted === 0 && rejected >= 3) meta.suppressed = true;
    if (accepted >= 3 && rejected === 0) meta.trusted = true;

    item.meta = meta;
    touched++;
  }

  return { touched };
}
