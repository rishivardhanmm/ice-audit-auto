import type { RiskLevel, Severity } from "@/lib/audit/types";
import { cn } from "@/lib/utils";

const riskClass: Record<RiskLevel, string> = {
  Critical: "border-red-200 bg-red-50 text-red-800",
  High: "border-orange-200 bg-orange-50 text-orange-800",
  Medium: "border-amber-200 bg-amber-50 text-amber-800",
  Low: "border-emerald-200 bg-emerald-50 text-emerald-800"
};

const severityClass: Record<Severity, string> = {
  critical: "border-red-200 bg-red-50 text-red-800",
  high: "border-orange-200 bg-orange-50 text-orange-800",
  medium: "border-amber-200 bg-amber-50 text-amber-800",
  low: "border-emerald-200 bg-emerald-50 text-emerald-800"
};

export function RiskBadge({ level, className }: { level: RiskLevel; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold", riskClass[level], className)}>
      {level}
    </span>
  );
}

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold capitalize", severityClass[severity], className)}>
      {severity}
    </span>
  );
}
