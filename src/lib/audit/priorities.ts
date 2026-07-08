import type { Priority, Severity } from "./types";

export const severityWeight: Record<Severity, number> = {
  critical: 25,
  high: 14,
  medium: 7,
  low: 3
};

export const severityRank: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

export function priorityForSeverity(severity: Severity): Priority {
  if (severity === "critical" || severity === "high") {
    return "immediate";
  }

  if (severity === "medium") {
    return "this-quarter";
  }

  return "later";
}

export function labelForPriority(priority: Priority): string {
  if (priority === "immediate") {
    return "Immediate";
  }

  if (priority === "this-quarter") {
    return "This quarter";
  }

  return "Later";
}
