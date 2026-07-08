import type { AuditFinding } from "@/lib/audit/types";

const blockedPathPatterns = [
  /\.env/i,
  /secret/i,
  /credential/i,
  /migration/i,
  /payment/i,
  /billing/i,
  /auth/i,
  /login/i,
  /password/i
];

export function isSafeAiPullRequestCandidate(finding: AuditFinding): boolean {
  if (!finding.canAiFix || finding.confidence === "low") {
    return false;
  }

  if (!finding.affectedFile) {
    return false;
  }

  return !blockedPathPatterns.some((pattern) => pattern.test(finding.affectedFile ?? ""));
}

export function aiPullRequestGuardrails(): string[] {
  return [
    "Create a new branch for one finding or one small group of related findings.",
    "Modify only files referenced by the selected finding evidence.",
    "Run tests and linting before opening a pull request.",
    "Include the audit finding, evidence, changes made, tests run, and risk level in the PR body.",
    "Never push directly to main and never merge automatically.",
    "Never change secrets, production credentials, migrations, payment code, authentication logic, or business-critical logic without explicit human approval."
  ];
}
