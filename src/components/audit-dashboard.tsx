"use client";

import { ArrowUpRight, Download, ExternalLink, FileText, FolderOpen, ShieldAlert } from "lucide-react";
import type { AuditFinding, AuditRun, Severity } from "@/lib/audit/types";
import { formatCategory, formatDateTime } from "@/lib/utils";
import { FindingsTable } from "./findings-table";
import { RiskBadge } from "./ui/risk-badge";
import { ScoreGauge } from "./ui/score-gauge";

const severityOrder: Severity[] = ["critical", "high", "medium", "low"];

export function AuditDashboard({ audit }: { audit: AuditRun }) {
  const severityCounts = countBy(audit.findings, "severity", severityOrder);
  const categoryCounts = [...countByDynamic(audit.findings, (finding) => finding.category).entries()].sort(
    (left, right) => right[1] - left[1]
  );
  const aiFixable = audit.findings.filter((finding) => finding.canAiFix).length;

  return (
    <div className="space-y-5">
      <section className="grid gap-4 lg:grid-cols-[1.1fr_1.4fr]">
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-audit">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-zinc-500">Audit Score</div>
              <h1 className="mt-1 text-2xl font-semibold text-zinc-950">
                {audit.repository.owner}/{audit.repository.name}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <RiskBadge level={audit.riskLevel} />
                {audit.repository.source === "github" ? (
                  <a
                    href={audit.repository.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
                  >
                    <ExternalLink className="size-3.5" aria-hidden="true" /> GitHub
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-700">
                    <FolderOpen className="size-3.5" aria-hidden="true" /> Local
                  </span>
                )}
              </div>
            </div>
            <ScoreGauge score={audit.score} />
          </div>
          <p className="mt-5 text-sm leading-6 text-zinc-600">{audit.summary.clientSummary}</p>
          {audit.repository.localPath ? (
            <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs text-zinc-600">
              {audit.repository.localPath}
            </div>
          ) : null}
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Metric label="Findings" value={audit.findings.length} />
            <Metric label="AI-fixable" value={aiFixable} />
            <Metric label="Completed" value={formatDateTime(audit.completedAt ?? audit.startedAt)} compact />
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-audit">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-zinc-950">Technical Summary</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{audit.summary.developerSummary}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <a
                href={`/api/audits/${audit.id}/report`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-300 px-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
              >
                <FileText className="size-4" aria-hidden="true" /> HTML
              </a>
              <a
                href={`/api/audits/${audit.id}/report/pdf`}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-zinc-950 px-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                <Download className="size-4" aria-hidden="true" /> PDF
              </a>
            </div>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <SeverityChart counts={severityCounts} />
            <CategoryChart counts={categoryCounts} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <ActionPanel title="Immediate" tone="red" items={audit.summary.immediateActions} />
        <ActionPanel title="This Quarter" tone="amber" items={audit.summary.thisQuarterActions} />
        <ActionPanel title="Later" tone="emerald" items={audit.summary.laterImprovements} />
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-audit">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-950">Detected Stack</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <Chip label="Languages" values={audit.stack.languages} />
              <Chip label="Frameworks" values={audit.stack.frameworks} />
              <Chip label="Packages" values={audit.stack.packageManagers} />
              <Chip label="Data" values={audit.stack.databases} />
              <Chip label="CI/CD" values={audit.stack.cicd} />
              <Chip label="Deployment" values={audit.stack.deployment} />
              <Chip label="Tools" values={audit.stack.tools} />
            </div>
          </div>
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600 lg:max-w-md">
            {audit.stack.evidence.length ? audit.stack.evidence.slice(0, 3).join(" | ") : "No stack evidence was detected beyond repository files."}
          </div>
        </div>
      </section>

      <FindingsTable findings={audit.findings} />
    </div>
  );
}

function Metric({ label, value, compact }: { label: string; value: string | number; compact?: boolean }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={compact ? "mt-1 text-sm font-semibold text-zinc-950" : "mt-1 text-2xl font-bold text-zinc-950"}>{value}</div>
    </div>
  );
}

function SeverityChart({ counts }: { counts: Record<Severity, number> }) {
  const max = Math.max(1, ...Object.values(counts));

  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-900">Severity</h3>
      <div className="mt-3 space-y-2">
        {severityOrder.map((severity) => (
          <div key={severity} className="grid grid-cols-[70px_1fr_28px] items-center gap-2 text-sm">
            <span className="capitalize text-zinc-600">{severity}</span>
            <div className="h-2 rounded-full bg-zinc-100">
              <div
                className={barClass(severity)}
                style={{ width: `${(counts[severity] / max) * 100}%` }}
              />
            </div>
            <span className="text-right font-semibold text-zinc-900">{counts[severity]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryChart({ counts }: { counts: Array<[string, number]> }) {
  const max = Math.max(1, ...counts.map(([, count]) => count));
  const visible = counts.slice(0, 6);

  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-900">Categories</h3>
      <div className="mt-3 space-y-2">
        {visible.length ? visible.map(([category, count]) => (
          <div key={category} className="grid grid-cols-[108px_1fr_28px] items-center gap-2 text-sm">
            <span className="truncate capitalize text-zinc-600">{formatCategory(category)}</span>
            <div className="h-2 rounded-full bg-zinc-100">
              <div className="h-2 rounded-full bg-teal-600" style={{ width: `${(count / max) * 100}%` }} />
            </div>
            <span className="text-right font-semibold text-zinc-900">{count}</span>
          </div>
        )) : (
          <p className="text-sm text-zinc-500">No category findings.</p>
        )}
      </div>
    </div>
  );
}

function ActionPanel({ title, tone, items }: { title: string; tone: "red" | "amber" | "emerald"; items: string[] }) {
  const toneClass = {
    red: "border-red-200 bg-red-50 text-red-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700"
  }[tone];

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-audit">
      <div className="flex items-center gap-2">
        <span className={`inline-grid size-8 place-items-center rounded-md border ${toneClass}`}>
          {tone === "red" ? <ShieldAlert className="size-4" aria-hidden="true" /> : <ArrowUpRight className="size-4" aria-hidden="true" />}
        </span>
        <h2 className="text-base font-semibold text-zinc-950">{title}</h2>
      </div>
      <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-600">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="border-l-2 border-zinc-200 pl-3">{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Chip({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-sm text-zinc-700">
      <span className="font-semibold text-zinc-950">{label}:</span> {values.join(", ")}
    </span>
  );
}

function countBy<K extends keyof AuditFinding>(
  findings: AuditFinding[],
  key: K,
  keys: AuditFinding[K][]
): Record<AuditFinding[K] & string, number> {
  const counts = Object.fromEntries(keys.map((item) => [item, 0])) as Record<AuditFinding[K] & string, number>;

  for (const finding of findings) {
    const value = finding[key] as AuditFinding[K] & string;
    counts[value] = (counts[value] ?? 0) + 1;
  }

  return counts;
}

function countByDynamic(findings: AuditFinding[], selector: (finding: AuditFinding) => string): Map<string, number> {
  const counts = new Map<string, number>();

  for (const finding of findings) {
    const value = selector(finding);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return counts;
}

function barClass(severity: Severity): string {
  const common = "h-2 rounded-full";

  if (severity === "critical") {
    return `${common} bg-red-600`;
  }

  if (severity === "high") {
    return `${common} bg-orange-600`;
  }

  if (severity === "medium") {
    return `${common} bg-amber-500`;
  }

  return `${common} bg-emerald-600`;
}
