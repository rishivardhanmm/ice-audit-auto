import { severityWeight } from "./priorities";
import type { AuditFindingInput, RiskLevel, ScoreBreakdown, Severity } from "./types";

const emptySeverityMap = <T>(value: T): Record<Severity, T> => ({
  critical: value,
  high: value,
  medium: value,
  low: value
});

export function calculateScore(findings: AuditFindingInput[]): ScoreBreakdown {
  const counts = emptySeverityMap(0);
  const penalties = emptySeverityMap(0);

  for (const finding of findings) {
    counts[finding.severity] += 1;
    penalties[finding.severity] += severityWeight[finding.severity];
  }

  const totalPenalty = Object.values(penalties).reduce((sum, penalty) => sum + penalty, 0);
  const score = Math.max(0, 100 - totalPenalty);

  return {
    score,
    riskLevel: riskLevelForScore(score, counts),
    penalties,
    counts
  };
}

export function riskLevelForScore(score: number, counts: Record<Severity, number>): RiskLevel {
  if (counts.critical > 0 || score < 50) {
    return "Critical";
  }

  if (counts.high > 0 || score < 70) {
    return "High";
  }

  if (counts.medium > 0 || score < 86) {
    return "Medium";
  }

  return "Low";
}
