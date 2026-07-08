import { runCommand } from "@/lib/github/repository";
import type { NpmAuditIssue, RepositoryFile, Severity } from "./types";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

export async function runNpmAudit(rootPath: string, files: RepositoryFile[]): Promise<NpmAuditIssue[]> {
  const hasLockfile = files.some((file) =>
    ["package-lock.json", "npm-shrinkwrap.json"].includes(file.path.toLowerCase())
  );

  if (!hasLockfile) {
    return [];
  }

  const result = await runCommand(npmCommand, ["audit", "--json", "--omit=dev"], rootPath, 45_000);
  const raw = result.stdout.trim();

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as {
      vulnerabilities?: Record<
        string,
        {
          name: string;
          severity: string;
          via?: Array<string | { title?: string; name?: string }>;
          range?: string;
          fixAvailable?: boolean | Record<string, unknown>;
        }
      >;
    };

    return Object.values(parsed.vulnerabilities ?? {}).map((issue) => ({
      packageName: issue.name,
      severity: normalizeSeverity(issue.severity),
      title: auditTitle(issue),
      via: (issue.via ?? []).map((via) => (typeof via === "string" ? via : via.title ?? via.name ?? "advisory")),
      range: issue.range,
      fixAvailable: Boolean(issue.fixAvailable)
    }));
  } catch {
    return [];
  }
}

function normalizeSeverity(severity: string): Severity {
  if (severity === "critical" || severity === "high" || severity === "medium" || severity === "low") {
    return severity;
  }

  return "medium";
}

function auditTitle(issue: { name: string; via?: Array<string | { title?: string; name?: string }> }): string {
  const advisory = issue.via?.find((via) => typeof via !== "string" && via.title);
  if (advisory && typeof advisory !== "string" && advisory.title) {
    return advisory.title;
  }

  return `Vulnerability reported for ${issue.name}`;
}
