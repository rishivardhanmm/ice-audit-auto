import type { AuditRun } from "@/lib/audit/types";

export type ScheduledAuditIntent = {
  projectId: string;
  cadence: "quarterly";
  nextRunAt: string;
  enabled: boolean;
};

export type EmailReportIntent = {
  auditRunId: string;
  recipients: string[];
  includePdf: boolean;
};

export function describeQuarterlySchedulerFlow(): string[] {
  return [
    "Select enabled scheduled_audits where next_run_at is due.",
    "Enqueue an audit job with the linked repository ID.",
    "Run the same scanner and rule engine used by manual audits.",
    "Store generated reports and mark the next run three months later.",
    "Send internal or client-branded email only after report generation succeeds."
  ];
}

export function canCreateAiPullRequest(auditRun: AuditRun): boolean {
  return auditRun.findings.some((finding) => finding.canAiFix && finding.confidence !== "low");
}
