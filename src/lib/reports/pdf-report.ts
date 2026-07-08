import PDFDocument from "pdfkit";
import type { AuditRun, Severity } from "@/lib/audit/types";

const severityColor: Record<Severity, string> = {
  critical: "#991b1b",
  high: "#c2410c",
  medium: "#a16207",
  low: "#047857"
};

export function buildPdfReport(auditRun: AuditRun): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(10).fillColor("#71717a").text("Quarterly Project Audit Agent");
    doc.moveDown(0.4);
    doc.fontSize(22).fillColor("#18181b").text(`${auditRun.repository.owner}/${auditRun.repository.name}`);
    doc.moveDown(0.8);
    doc.fontSize(11).fillColor("#3f3f46").text(auditRun.summary.clientSummary, { width: 490 });
    doc.moveDown(1);

    metricRow(doc, auditRun);
    section(doc, "Developer Summary", auditRun.summary.developerSummary);
    bulletSection(doc, "Immediate Actions", auditRun.summary.immediateActions);
    bulletSection(doc, "This-Quarter Actions", auditRun.summary.thisQuarterActions);
    bulletSection(doc, "Later Improvements", auditRun.summary.laterImprovements);

    section(
      doc,
      "Detected Stack",
      [
        auditRun.stack.languages.length ? `Languages: ${auditRun.stack.languages.join(", ")}` : undefined,
        auditRun.stack.frameworks.length ? `Frameworks: ${auditRun.stack.frameworks.join(", ")}` : undefined,
        auditRun.stack.packageManagers.length ? `Package managers: ${auditRun.stack.packageManagers.join(", ")}` : undefined,
        auditRun.stack.databases.length ? `Data: ${auditRun.stack.databases.join(", ")}` : undefined,
        auditRun.stack.cicd.length ? `CI/CD: ${auditRun.stack.cicd.join(", ")}` : undefined,
        auditRun.stack.deployment.length ? `Deployment: ${auditRun.stack.deployment.join(", ")}` : undefined
      ]
        .filter(Boolean)
        .join("\n") || "No stack signals detected."
    );

    doc.addPage();
    doc.fontSize(18).fillColor("#18181b").text("Findings");
    doc.moveDown(0.5);

    if (auditRun.findings.length === 0) {
      doc.fontSize(11).fillColor("#3f3f46").text("No findings were generated.");
    }

    for (const finding of auditRun.findings) {
      if (doc.y > 680) {
        doc.addPage();
      }

      doc.fontSize(13).fillColor("#18181b").text(finding.title);
      doc.fontSize(9).fillColor(severityColor[finding.severity]).text(`${finding.severity.toUpperCase()} | ${finding.category} | ${finding.priority}`);
      doc.moveDown(0.2);
      doc.fontSize(10).fillColor("#3f3f46").text(finding.description);
      doc.moveDown(0.2);
      doc.fillColor("#52525b").text(`Evidence: ${finding.evidence}`);
      if (finding.affectedFile) {
        doc.text(`Affected file: ${finding.affectedFile}`);
      }
      doc.text(`Recommended fix: ${finding.recommendedFix}`);
      doc.text(`Business impact: ${finding.businessImpact}`);
      doc.moveDown(0.9);
    }

    doc.end();
  });
}

function metricRow(doc: PDFKit.PDFDocument, auditRun: AuditRun): void {
  const top = doc.y;
  const width = 112;
  const metrics = [
    ["Score", `${auditRun.score}/100`],
    ["Risk", auditRun.riskLevel],
    ["Findings", String(auditRun.findings.length)],
    ["Completed", formatDate(auditRun.completedAt ?? auditRun.startedAt)]
  ];

  metrics.forEach(([label, value], index) => {
    const x = 48 + index * 122;
    doc.roundedRect(x, top, width, 48, 6).strokeColor("#e4e4e7").stroke();
    doc.fontSize(8).fillColor("#71717a").text(label, x + 10, top + 9, { width: width - 20 });
    doc.fontSize(13).fillColor("#18181b").text(value, x + 10, top + 24, { width: width - 20 });
  });

  doc.y = top + 66;
}

function section(doc: PDFKit.PDFDocument, title: string, content: string): void {
  if (doc.y > 680) {
    doc.addPage();
  }

  doc.fontSize(15).fillColor("#18181b").text(title);
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor("#3f3f46").text(content, { width: 490 });
  doc.moveDown(1);
}

function bulletSection(doc: PDFKit.PDFDocument, title: string, items: string[]): void {
  if (doc.y > 650) {
    doc.addPage();
  }

  doc.fontSize(15).fillColor("#18181b").text(title);
  doc.moveDown(0.3);

  for (const item of items) {
    doc.fontSize(10).fillColor("#3f3f46").text(`- ${item}`, { width: 490 });
  }

  doc.moveDown(1);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
