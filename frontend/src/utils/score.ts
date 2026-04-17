import type { AuditSummary } from "../services/results.service.ts";

/**
 * Returns the best available score for a report.
 * When overallScore is 0 but findings exist (agent didn't compute it),
 * estimates from severity penalties: critical −6, high −3, medium −1.5, low −0.5.
 */
export function deriveScore(summary: AuditSummary): {
  score: number;
  derived: boolean;
} {
  if (summary.overallScore > 0 || summary.totalFindings === 0) {
    return { score: summary.overallScore, derived: false };
  }
  const s = summary.bySeverity;
  const penalty =
    (s["critical"] ?? 0) * 6 +
    (s["high"] ?? 0) * 3 +
    (s["medium"] ?? 0) * 1.5 +
    (s["low"] ?? 0) * 0.5;
  return { score: Math.max(0, Math.round(100 - penalty)), derived: true };
}
