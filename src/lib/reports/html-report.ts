import type { AuditRun, Severity } from "@/lib/audit/types";

const severityColor: Record<Severity, string> = {
  critical: "#b91c1c",
  high: "#c2410c",
  medium: "#a16207",
  low: "#047857"
};

export function buildHtmlReport(auditRun: AuditRun): string {
  const findings = auditRun.findings
    .map(
      (finding) => `
        <section class="finding">
          <div class="finding-heading">
            <h3>${escapeHtml(finding.title)}</h3>
            <span style="background:${severityColor[finding.severity]}">${escapeHtml(finding.severity)}</span>
          </div>
          <p>${escapeHtml(finding.description)}</p>
          <dl>
            <dt>Category</dt><dd>${escapeHtml(finding.category)}</dd>
            <dt>Priority</dt><dd>${escapeHtml(finding.priority)}</dd>
            <dt>Evidence</dt><dd>${escapeHtml(finding.evidence)}</dd>
            <dt>Affected file</dt><dd>${escapeHtml(finding.affectedFile ?? "N/A")}</dd>
            <dt>Recommended fix</dt><dd>${escapeHtml(finding.recommendedFix)}</dd>
            <dt>Business impact</dt><dd>${escapeHtml(finding.businessImpact)}</dd>
            <dt>AI fix candidate</dt><dd>${finding.canAiFix ? "Yes" : "No"}</dd>
            <dt>Confidence</dt><dd>${escapeHtml(finding.confidence)}</dd>
          </dl>
        </section>
      `
    )
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Quarterly Project Audit - ${escapeHtml(auditRun.repository.owner)}/${escapeHtml(auditRun.repository.name)}</title>
    <style>
      body { margin: 0; color: #18181b; background: #f4f4f5; font: 14px/1.55 Arial, sans-serif; }
      main { max-width: 980px; margin: 0 auto; padding: 40px 24px; }
      header, section { background: #fff; border: 1px solid #e4e4e7; border-radius: 8px; padding: 24px; margin-bottom: 16px; }
      h1, h2, h3 { margin: 0 0 12px; line-height: 1.2; }
      h1 { font-size: 30px; }
      h2 { font-size: 20px; }
      h3 { font-size: 16px; }
      .meta { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 20px; }
      .metric { border: 1px solid #e4e4e7; border-radius: 8px; padding: 14px; }
      .label { color: #71717a; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
      .value { font-size: 22px; font-weight: 700; margin-top: 4px; }
      ul { margin: 8px 0 0; padding-left: 20px; }
      .finding-heading { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
      .finding-heading span { border-radius: 999px; color: #fff; font-size: 11px; font-weight: 700; padding: 5px 9px; text-transform: uppercase; }
      dl { display: grid; grid-template-columns: 160px 1fr; gap: 8px 16px; margin: 16px 0 0; }
      dt { color: #71717a; font-weight: 700; }
      dd { margin: 0; }
      @media print { body { background: #fff; } main { padding: 0; } section, header { break-inside: avoid; } }
    </style>
  </head>
  <body>
    <main>
      <header>
        <p class="label">Quarterly Project Audit Agent</p>
        <h1>${escapeHtml(auditRun.repository.owner)}/${escapeHtml(auditRun.repository.name)}</h1>
        <p>${escapeHtml(auditRun.summary.clientSummary)}</p>
        <div class="meta">
          <div class="metric"><div class="label">Score</div><div class="value">${auditRun.score}/100</div></div>
          <div class="metric"><div class="label">Risk</div><div class="value">${escapeHtml(auditRun.riskLevel)}</div></div>
          <div class="metric"><div class="label">Findings</div><div class="value">${auditRun.findings.length}</div></div>
          <div class="metric"><div class="label">Completed</div><div class="value">${escapeHtml(formatDate(auditRun.completedAt ?? auditRun.startedAt))}</div></div>
        </div>
      </header>

      <section>
        <h2>Developer Summary</h2>
        <p>${escapeHtml(auditRun.summary.developerSummary)}</p>
      </section>

      <section>
        <h2>Immediate Actions</h2>
        ${list(auditRun.summary.immediateActions)}
      </section>

      <section>
        <h2>This-Quarter Actions</h2>
        ${list(auditRun.summary.thisQuarterActions)}
      </section>

      <section>
        <h2>Later Improvements</h2>
        ${list(auditRun.summary.laterImprovements)}
      </section>

      <section>
        <h2>Detected Stack</h2>
        <p>${escapeHtml(stackLine(auditRun))}</p>
      </section>

      ${findings || "<section><h2>Findings</h2><p>No findings were generated.</p></section>"}
    </main>
  </body>
</html>`;
}

function list(items: string[]): string {
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function stackLine(auditRun: AuditRun): string {
  const parts = [
    auditRun.stack.languages.length ? `Languages: ${auditRun.stack.languages.join(", ")}` : undefined,
    auditRun.stack.frameworks.length ? `Frameworks: ${auditRun.stack.frameworks.join(", ")}` : undefined,
    auditRun.stack.databases.length ? `Data: ${auditRun.stack.databases.join(", ")}` : undefined,
    auditRun.stack.cicd.length ? `CI/CD: ${auditRun.stack.cicd.join(", ")}` : undefined,
    auditRun.stack.deployment.length ? `Deployment: ${auditRun.stack.deployment.join(", ")}` : undefined
  ].filter(Boolean);

  return parts.join(" | ") || "No stack signals detected.";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
